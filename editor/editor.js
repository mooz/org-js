$(function () {
  var $orgInputArea = $("#org-input");
  var $resultArea = $("#result");

  var orgParser = new Org.Parser();

  function getCode() {
    return $orgInputArea.val();
  }

  function setCode(code, updateView) {
    $orgInputArea.val(code);
    if (updateView)
      updateHTML();
  }

  function setHTMLFromCode(code) {
    try {
      var docHTML = orgParser.parse(code).convert(Org.ConverterHTML).toString();
      $resultArea.html(docHTML);
    } catch (x) {
      $resultArea.empty();
      $resultArea.append($("<pre>").text(x));
      return;
    }
  }

  function updateHTML() {
    setHTMLFromCode(getCode());
    prettyPrint();
  }

  $orgInputArea.on("input", updateHTML);

  $.ajax({
    url: "./README.org",
    dataType: "text"
  }).done(function (data, sattus, $xhr) {
    setCode(data, true);
  }).fail(function ($xhr, status, error) {
    alert("error: " + status);
  });

  updateHTML();
});
