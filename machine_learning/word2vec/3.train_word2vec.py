from tensorflow.keras import layers
from utils.text_processor import OutputTextProcessor
import tensorflow as tf
import io
import os
import sys

script_dir = os.path.dirname(__file__)
module_dir = os.path.join(script_dir, '..')
sys.path.append(module_dir)


SEED = 42
AUTOTUNE = tf.data.AUTOTUNE

DATASET_PATH = 'words-100k.txt'
SAVE_PATH = 'model-64-32k-100k'

# Generates skip-gram pairs with negative sampling for a list of sequences
# (int-encoded sentences) based on window size, number of negative samples
# and vocabulary size.


def generate_training_data(sequences, window_size, num_ns, vocab_size, seed):
    def _generate_training_data():
        # Build the sampling table for `vocab_size` tokens.
        sampling_table = tf.keras.preprocessing.sequence.make_sampling_table(
            vocab_size)

        # Iterate over all sequences (sentences) in the dataset.
        for sequence in sequences:

            # Generate positive skip-gram pairs for a sequence (sentence).
            positive_skip_grams, _ = tf.keras.preprocessing.sequence.skipgrams(
                sequence,
                vocabulary_size=vocab_size,
                sampling_table=sampling_table,
                window_size=window_size,
                negative_samples=0)

            # Iterate over each positive skip-gram pair to produce training examples
            # with a positive context word and negative samples.
            for target_word, context_word in positive_skip_grams:
                context_class = tf.expand_dims(
                    tf.constant([context_word], dtype="int64"), 1)
                negative_sampling_candidates, _, _ = tf.random.log_uniform_candidate_sampler(
                    true_classes=context_class,
                    num_true=1,
                    num_sampled=num_ns,
                    unique=True,
                    range_max=vocab_size,
                    seed=seed,
                    name="negative_sampling")

                # Build context and label vectors (for one target word)
                context = tf.concat(
                    [tf.squeeze(context_class, 1), negative_sampling_candidates], 0)
                label = tf.constant([1] + [0]*num_ns, dtype="int64")

                # Append each element from the training example to global lists.
                yield (target_word, context), label
    return _generate_training_data

# https://github.com/tensorflow/tensorflow/issues/43559#issuecomment-1549988416


class Word2Vec(tf.keras.Model):
    def __init__(self, vocab_size: int, embedding_dim: int, num_ns: int):
        super(Word2Vec, self).__init__()
        self.target_embedding = layers.Embedding(vocab_size,
                                                 embedding_dim,
                                                 input_length=1,
                                                 name="w2v_embedding")
        self.context_embedding = layers.Embedding(vocab_size,
                                                  embedding_dim,
                                                  input_length=num_ns+1)

    def call(self, pair):
        target, context = pair
        # target: (batch, dummy?)  # The dummy axis doesn't exist in TF2.7+
        # context: (batch, context)
        if len(target.shape) == 2:
            target = tf.squeeze(target, axis=1)
        # target: (batch,)
        word_emb = self.target_embedding(target)
        # word_emb: (batch, embed)
        context_emb = self.context_embedding(context)
        # context_emb: (batch, context, embed)
        dots = tf.einsum('be,bce->bc', word_emb, context_emb)
        # dots: (batch, context)
        return dots


def subsampling_frequent_words(text):
    # TODO: Fix replace
    # example sentences: "terjadi sampai" will be replaced to "terjasampai"
    # expected -- just ignore, don't replace it
    return tf.strings.regex_replace(text, r"(dan|yang|di|pada|dari|dengan|dalam|ini|untuk|adalah|sebagai|oleh|ke|the)\s", '')


if __name__ == '__main__':
    text_ds = tf.data.TextLineDataset(
        DATASET_PATH).filter(lambda x: tf.cast(tf.strings.length(x), bool))

    # Define the vocabulary size and the number of words in a sequence.
    vocab_size = 32000
    sequence_length = 64

    # Use the `TextVectorization` layer to normalize, split, and map strings to
    # integers. Set the `output_sequence_length` length to pad all samples to the
    # same length.
    vectorize_layer = OutputTextProcessor(
        max_tokens=vocab_size, output_sequence_length=sequence_length)
    vectorize_layer.adapt(text_ds.map(subsampling_frequent_words).batch(1024))
    # Save the created vocabulary for reference.
    inverse_vocab = vectorize_layer.get_vocabulary()
    print(inverse_vocab[:10], inverse_vocab[-10:])

    # Vectorize the data in text_ds.
    text_vector_ds = text_ds.batch(1024).prefetch(
        AUTOTUNE).map(vectorize_layer).unbatch()
    sequences = list(text_vector_ds.as_numpy_iterator())
    print(len(sequences))

    for seq in sequences[:3]:
        print(f"{seq} => {[inverse_vocab[i] for i in seq]}")

    BATCH_SIZE = 1024
    BUFFER_SIZE = 10000
    dataset = tf.data.Dataset.from_generator(
        generate_training_data(
            sequences=sequences,
            window_size=2,
            num_ns=4,
            vocab_size=vocab_size,
            seed=SEED),
        output_signature=(
            (tf.TensorSpec(shape=(), dtype=tf.int64),
             tf.TensorSpec(shape=(5,), dtype=tf.int64)),
            tf.TensorSpec(shape=(5,), dtype=tf.int64)))
    for (target, context), label in dataset.take(1):
        print(f"target_index    : {target}")
        print(f"target_word     : {inverse_vocab[target]}")
        print(f"context_indices : {context}")
        print(
            f"context_words   : {[inverse_vocab[c.numpy()] for c in context]}")
        print(f"label           : {label}")
    dataset = dataset.shuffle(BUFFER_SIZE).batch(
        BATCH_SIZE, drop_remainder=True)
    print(dataset)
    dataset = dataset.cache().prefetch(buffer_size=AUTOTUNE)
    print(dataset)

    embedding_dim = 64
    word2vec = Word2Vec(vocab_size, embedding_dim, num_ns=4)
    word2vec.compile(optimizer='adam',
                     loss=tf.keras.losses.CategoricalCrossentropy(
                         from_logits=True),
                     metrics=['accuracy'])

    tensorboard_callback = tf.keras.callbacks.TensorBoard(log_dir="logs")
    model_checkpoint_callback = tf.keras.callbacks.ModelCheckpoint(
        filepath=os.path.join(SAVE_PATH, 'ckpt-model/word2vec-{epoch:02d}'),
        save_weights_only=True,
        save_freq='epoch')

    history = word2vec.fit(dataset, epochs=30, callbacks=[
                           tensorboard_callback, model_checkpoint_callback])

    out_v = io.open(os.path.join(SAVE_PATH, 'vectors.tsv'),
                    'w', encoding='utf-8')
    out_m = io.open(os.path.join(SAVE_PATH, 'metadata.tsv'),
                    'w', encoding='utf-8')

    w2v_embedding_layer = word2vec.get_layer('w2v_embedding')
    weights = w2v_embedding_layer.get_weights()[0]
    vocab = vectorize_layer.get_vocabulary()

    for index, word in enumerate(vocab):
        if index == 0:
            continue  # skip 0, it's padding.
        vec = weights[index]
        out_v.write('\t'.join([str(x) for x in vec]) + "\n")
        out_m.write(word + "\n")
    out_v.close()
    out_m.close()

    w2v_embedding_ckpt = tf.train.Checkpoint(layer=w2v_embedding_layer)
    w2v_embedding_ckpt.save(os.path.join(
        SAVE_PATH, 'ckpt', 'w2v_embedding'))
