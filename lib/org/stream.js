function Stream(sequence) {
  this.sequences = sequence.split(/\r?\n/);
  this.totalLines = this.sequences.length;
  this.lineNumber = 0;
}

Stream.prototype.peekNextLine = function () {
  return this.hasNext() ? this.sequences[this.lineNumber] : null;
};

Stream.prototype.getNextLine = function () {
  return this.hasNext() ? this.sequences[this.lineNumber++] : null;
};

Stream.prototype.hasNext = function () {
  return this.lineNumber < this.totalLines;
};

if (typeof exports !== "undefined") {
  exports.Stream = Stream;
}
