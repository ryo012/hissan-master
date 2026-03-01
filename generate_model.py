import tensorflow as tf
import tensorflowjs as tfjs

print("Loading MNIST data...")
mnist = tf.keras.datasets.mnist
(x_train, y_train), _ = mnist.load_data()
x_train = x_train / 255.0

print("Building model...")
model = tf.keras.models.Sequential([
  tf.keras.layers.Flatten(input_shape=(28, 28)),
  tf.keras.layers.Dense(64, activation='relu'),
  tf.keras.layers.Dense(10, activation='softmax')
])

model.compile(optimizer='adam',
              loss='sparse_categorical_crossentropy',
              metrics=['accuracy'])

print("Training model (approx 5 sec)...")
model.fit(x_train, y_train, epochs=3, batch_size=256)

print("Exporting to tfjs format in ./mnist_model...")
tfjs.converters.save_keras_model(model, './mnist_model')
print("Done!")
