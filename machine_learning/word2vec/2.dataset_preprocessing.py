# To run this file, you must run ./1 download_wiki_vocab.py first
# Otherwise it will throw error

import tqdm
import tensorflow as tf

ITERATION = 102400

VOCAB_PATH = './idwiki_vocab.txt'
OUTPUT_DATASET_PATH = './words-100k.txt'

if __name__ == '__main__':
    # load classification dataset
    raw_ds = tf.keras.utils.text_dataset_from_directory('../classification/dataset')
    ds = raw_ds.map(lambda x, y: x).unbatch()

    for text in ds.take(3):
        print(tf.compat.as_str(text.numpy()))


    with open(VOCAB_PATH, encoding='UTF8') as file:
        with open(OUTPUT_DATASET_PATH, 'w', encoding='UTF8') as words:
            # append classification dataset
            for text in ds:
                txt = tf.compat.as_str(text.numpy()).strip()
                if txt:
                    words.write(txt + '\n')
            # append wiki dataset
            for i in tqdm.tqdm(range(ITERATION)):
                line = file.readline().lower()
                words.write(line)
