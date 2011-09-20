window.addEventListener("load", function () {
  var orgInputArea = document.getElementById("org-input");
  var resultArea = document.getElementById("result");

  var parser = new Parser();

  function getCode() {
    return orgInputArea.value;
  }

  function setCode(code, updateHTML) {
    orgInputArea.value = code;
    if (updateHTML)
      setHTMLFromCode(code);
  }

  function setHTMLFromCode(code) {
    try {
      var nodes = parser.parse(code);
    } catch (x) {
      alert(x);
      return;
    }

    resultArea.innerHTML = HtmlTextConverter.convertNodes(nodes);
  }

  function onUpdate(ev) {
    setHTMLFromCode(getCode());
  }

  function saveToLocalStorage() {
    var code = getCode();
    localStorage["code"] = code;
  }

  function restoreFromStorage() {
    if (localStorage["code"])
      setCode(localStorage["code"], true);
  }

  orgInputArea.addEventListener("input", onUpdate, false);
  setInterval(saveToLocalStorage, 5000);

  restoreFromStorage();
}, false);
