import re
import string
import collections

import tensorflow as tf
import numpy as np


class OutputTextProcessor(tf.keras.layers.TextVectorization):
    def __init__(
            self,   **kwargs):
        super(OutputTextProcessor, self).__init__(
            standardize=self.tf_lower_and_split_punct,
            output_mode='int',
            **kwargs)

    def tf_lower_and_split_punct(self, input_data):
        lowercase = tf.strings.lower(input_data)
        return tf.strings.regex_replace(lowercase,
                                        '[%s]' % re.escape(string.punctuation), '')

    def get_vocabulary(self):
        keys, values = self._lookup_layer.lookup_table.export()
        keys, values = (self._tensor_vocab_to_numpy(keys), values.numpy())
        lookup = collections.defaultdict(
            lambda: self._lookup_layer.oov_token, zip(values, keys)
        )
        keys = [lookup[x] for x in range(self.vocabulary_size())]
        keys[0] = self._lookup_layer.mask_token
        return keys

    def _tensor_vocab_to_numpy(self, vocab):
        return np.array(
            [self._decode_bytes(x) for x in vocab.numpy()])

    def _decode_bytes(self, bytes_or_text):
        try:
            return tf.compat.as_text(bytes_or_text, 'utf-8')
        # TODO: just ignore non utf-8 character
        except:
            return tf.compat.as_text(bytes_or_text, 'ISO-8859-1')
