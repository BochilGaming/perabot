# Reference from https://medium.com/@diekanugraha/membuat-model-word2vec-bahasa-indonesia-dari-wikipedia-menggunakan-gensim-e5745b98714d

import time
import gensim
import io
from datetime import timedelta

DUMP_WIKI_PATH = 'idwiki-latest-pages-articles.xml.bz2'
OUTPUT_VOCAB_PATH = 'idwiki_vocab.txt'

if __name__ == '__main__':
    start_time = time.time()
    print('Streaming wiki...')
    id_wiki = gensim.corpora.WikiCorpus(
        DUMP_WIKI_PATH,
        dictionary={}, lower=True)
    article_count = 0
    with io.open(OUTPUT_VOCAB_PATH, 'w', encoding='utf-8') as wiki_txt:
        for text in id_wiki.get_texts():

            wiki_txt.write(" ".join(text) + '\n')
            article_count += 1

            if article_count % 10000 == 0:
                print('{} articles processed'.format(article_count))
        print('total: {} articles'.format(article_count))

    finish_time = time.time()
    print('Elapsed time: {}'.format(timedelta(seconds=finish_time-start_time)))
