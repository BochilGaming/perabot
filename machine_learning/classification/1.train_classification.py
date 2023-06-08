import os
import sys

script_dir = os.path.dirname(__file__)
module_dir = os.path.join(script_dir, '..')
sys.path.append(module_dir)

import tensorflow as tf

from tensorflow.keras import layers
from utils.text_processor import OutputTextProcessor

MODEL_PATH = os.path.join('..', 'word2vec', 'model-64-32k-100k')
DATASET_PATH = os.path.join('.', 'dataset')


def vectorize_text(text, label):
    text = tf.expand_dims(text, -1)
    return vectorize_layer(text), label


if __name__ == '__main__':
    vocab_ds = tf.data.TextLineDataset(os.path.join(MODEL_PATH, 'metadata.tsv')).filter(
        # ignore [UNK] token
        lambda text: tf.cast(not tf.strings.regex_full_match(text, '\[UNK\]'), bool))

    # Define the vocabulary size and the number of words in a sequence.
    vocab_size = 32000
    sequence_length = 64

    vectorize_layer = OutputTextProcessor(
        max_tokens=vocab_size,
        output_sequence_length=sequence_length,
        # add vocab
        vocabulary=tf.constant(
            [text.numpy() for text in vocab_ds]))

    vocab = vectorize_layer.get_vocabulary()
    print(vocab[:10], vocab[-10:])

    raw_train_dataset = tf.keras.utils.text_dataset_from_directory(DATASET_PATH,
                                                                   label_mode='categorical')

    class_name = raw_train_dataset.class_names
    print("Class:", class_name)

    text_batch, label_batch = next(iter(raw_train_dataset))
    first_review, first_label = text_batch[0], label_batch[0]
    label_as_list = first_label.numpy().tolist()
    print("Review", first_review)
    print("Label", class_name[label_as_list.index(max(label_as_list))])
    print("Vectorized review", vectorize_text(first_review, first_label))

    train_dataset = raw_train_dataset.map(vectorize_text)
    train_dataset = train_dataset.cache().prefetch(buffer_size=tf.data.AUTOTUNE)

    w2v_layer = layers.Embedding(vocab_size,
                                          sequence_length,
                                          mask_zero=True,
                                          name="w2v_embedding")
    w2v_layer.trainable = False
    model = tf.keras.Sequential([
        w2v_layer,
        layers.Bidirectional(layers.LSTM(64, return_sequences=True)),
        layers.Bidirectional(layers.LSTM(32)),
        layers.Dropout(.5),
        layers.Dense(64, activation='relu'),
        layers.Dense(32, activation='relu'),
        layers.Dense(len(class_name), activation='softmax')
    ])
    model.compile(loss=tf.keras.losses.CategoricalCrossentropy(),
                  optimizer=tf.keras.optimizers.Adam(),
                  metrics=['accuracy'])
    model.summary()

    ckpt_dir = tf.train.latest_checkpoint(os.path.join(MODEL_PATH, 'ckpt'))
    print("Load embedding checkpoint from:", ckpt_dir)
    checkpoint = tf.train.Checkpoint(layer=w2v_layer)
    checkpoint.restore(ckpt_dir).assert_consumed()

    epochs = 20

    history = model.fit(
        train_dataset,
        epochs=epochs)
    model.save('./pretrained')