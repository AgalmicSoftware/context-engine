(function bootstrapCeTheme() {
  var root = document.documentElement;
  var allowedThemeIds = String(root.dataset.ceThemeRegistry || '')
    .split(' ')
    .filter(Boolean);
  var isAllowed = function isAllowed(value) {
    return allowedThemeIds.indexOf(value) !== -1;
  };
  var storedTheme = '';
  var colorBlindMode = false;
  var deploymentTheme = String(root.dataset.ceDeploymentTheme || '')
    .trim()
    .toLowerCase();

  try {
    var themeDefaultVersion = '2026-10-13-civic-v1';
    var themeDefaultVersionKey = 'ce:theme-default-version';
    if (
      (!isAllowed(deploymentTheme) || deploymentTheme === 'civic') &&
      window.localStorage.getItem(themeDefaultVersionKey) !== themeDefaultVersion
    ) {
      // Mark first so failed writes cannot repeatedly erase later theme choices.
      // This reset is separate from routine derived-data cache version bumps.
      window.localStorage.setItem(themeDefaultVersionKey, themeDefaultVersion);
      window.localStorage.removeItem('ce:theme');
    }
  } catch (_error) {
    // Read any retained preference below so bootstrap and the app agree.
  }

  try {
    storedTheme = String(window.localStorage.getItem('ce:theme') || '')
      .trim()
      .toLowerCase();
    colorBlindMode = window.localStorage.getItem('ce:color-vision') === 'color-blind';
  } catch (_error) {
    storedTheme = '';
  }

  var themeId = isAllowed(storedTheme) ? storedTheme : isAllowed(deploymentTheme) ? deploymentTheme : 'civic';

  root.dataset.ceTheme = themeId;
  root.dataset.ceColorVision = colorBlindMode ? 'color-blind' : 'standard';
  root.dataset.ceThemeSource = isAllowed(storedTheme) ? 'user' : isAllowed(deploymentTheme) ? 'deployment' : 'default';
  var lightThemeIds = String(root.dataset.ceLightThemes || '')
    .split(' ')
    .filter(Boolean);
  root.style.colorScheme = lightThemeIds.indexOf(themeId) !== -1 ? 'light' : 'dark';

  // Match the browser bar to the theme's page background before the app loads.
  var themeColorMeta = document.querySelector('meta[name="theme-color"]');
  var themeColors = String(root.dataset.ceThemeColors || '').split(' ');
  for (var index = 0; themeColorMeta && index < themeColors.length; index += 1) {
    var separator = themeColors[index].lastIndexOf(':');
    if (separator > 0 && themeColors[index].slice(0, separator) === themeId) {
      themeColorMeta.setAttribute('content', themeColors[index].slice(separator + 1));
    }
  }
})();
