/* Une fenêtre ne se ferme plus quand on glisse la souris hors d'elle.
   Sélectionner du texte en partant de l'intérieur et en relâchant le
   bouton sur le fond grisé produisait un « clic » sur le fond : la
   fenêtre se fermait et le texte tapé était perdu. On ne ferme que si
   le bouton a aussi été enfoncé sur le fond. */
(function () {
  var debut = null;
  document.addEventListener('mousedown', function (e) { debut = e.target; }, true);
  document.addEventListener('touchstart', function (e) { debut = e.target; }, true);
  document.addEventListener('click', function (e) {
    var t = e.target;
    var fond = t && t.classList && (t.classList.contains('modal-overlay') || t.id === 'mb' || t.id === 'detailMb');
    if (fond && debut && debut !== t) {
      /* le clic est issu d'un glissement commencé ailleurs */
      e.stopPropagation();
      e.preventDefault();
    }
    debut = null;
  }, true);
})();
