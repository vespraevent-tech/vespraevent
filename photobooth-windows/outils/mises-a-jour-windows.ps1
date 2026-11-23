# Vespra Event Photobooth - empêche Windows d'installer ou de redémarrer en plein événement.
# À lancer UNE FOIS sur le mini-PC : clic droit sur ce fichier > « Exécuter avec PowerShell » (accepter l'élévation administrateur).
# Pour revenir au comportement normal de Windows : lancer avec  -Annuler
#
# Ce que fait ce script (tout est réversible) :
#   1. Windows prévient qu'une mise à jour existe mais ne la télécharge ni ne l'installe tout seul (AUOptions = 2).
#   2. Windows ne redémarre jamais tout seul quand une session est ouverte (NoAutoRebootWithLoggedOnUsers = 1).
#   3. Heures d'activité de 6 h à minuit (18 h, le maximum autorisé) : pas de redémarrage pendant ce créneau.
# Les mises à jour de sécurité restent possibles : à faire de temps en temps, HORS événement (Paramètres > Windows Update > Rechercher).
# Limite : sur Windows « Famille » certaines règles sont ignorées ; la suspension manuelle (Paramètres > Windows Update > Suspendre) reste possible.
param([switch]$Annuler)

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" $(if ($Annuler) { '-Annuler' })"
  exit
}

$wu = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate'
$au = "$wu\AU"

if ($Annuler) {
  Remove-Item -Path $wu -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host 'Windows Update est revenu à son comportement normal.' -ForegroundColor Yellow
} else {
  New-Item -Path $au -Force | Out-Null
  Set-ItemProperty -Path $au -Name NoAutoUpdate -Value 0 -Type DWord
  Set-ItemProperty -Path $au -Name AUOptions -Value 2 -Type DWord
  Set-ItemProperty -Path $au -Name NoAutoRebootWithLoggedOnUsers -Value 1 -Type DWord
  Set-ItemProperty -Path $wu -Name SetActiveHours -Value 1 -Type DWord
  Set-ItemProperty -Path $wu -Name ActiveHoursStart -Value 6 -Type DWord
  Set-ItemProperty -Path $wu -Name ActiveHoursEnd -Value 0 -Type DWord
  Write-Host 'Fait : Windows ne téléchargera, n''installera et ne redémarrera plus tout seul.' -ForegroundColor Green
  Write-Host 'Pensez à lancer les mises à jour vous-même de temps en temps, hors événement.'
}
Write-Host ''
Read-Host 'Appuyez sur Entrée pour fermer'
