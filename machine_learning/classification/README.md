# Classification 
Machine learning[^machinelearning]-based classification. This classifier is based on a slightly modified implementation of the TensorFlow[^tensorflow] tutorials ["Basic Text Classification"](https://www.tensorflow.org/tutorials/keras/text_classification) and ["Text Classification with TF Hub"](https://www.tensorflow.org/tutorials/keras/text_classification_with_hub). However, in the TensorFlow[^tensorflow] tutorial ["Text Classification with TF Hub"](https://www.tensorflow.org/tutorials/keras/text_classification_with_hub) using word embedding from [TensorFlow Hub](https://www.tensorflow.org/hub) -- this classifier uses the pre-trained word2vec model, for more information you can visit this [README.md](https://github.com/BochilGaming/perabot/tree/master/machine_learning/word2vec/README.md).

### Convert [SavedModel](https://github.com/tensorflow/tensorflow/blob/master/tensorflow/python/saved_model/README.md) to tfjs_layers_model
```sh
tensorflowjs_converter --input=keras_saved_model pretrained pretrained-tfjs
```
For more information on how to convert a TensorFlow[^tensorflow] model, you can visit the TensorFlow[^tensorflow] [guide](https://www.tensorflow.org/js/guide/conversion)

### Footnotes
[^machinelearning]: https://en.wikipedia.org/wiki/Machine_learning
[^tensorflow]: https://www.tensorflow.org/