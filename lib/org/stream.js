function Stream(sequence) {
  this.sequences = sequence.split("\n");
  this.sequenceCount = this.sequences.length;
  this.position = 0;
}

Stream.prototype.peekNextLine = function () {
  return this.hasNext() ? this.sequences[this.position] : null;
};

Stream.prototype.getNextLine = function () {
  return this.hasNext() ? this.sequences[this.position++] : null;
};

Stream.prototype.hasNext = function () {
  return this.position < this.sequenceCount;
};

if (typeof exports !== "undefined") {
  exports.Stream = Stream;
}
