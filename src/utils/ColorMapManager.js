/**
 * ColorMapManager - React port of the Angular ColorMap class
 * Loads and processes colormap definitions from colorMaps.json
 */

class ColorMapManager {
  constructor(rawColorMaps = []) {
    this.RawColorMaps = rawColorMaps;
    this.ColorMaps = [];
    this.colorMapCache = {};
    
    if (rawColorMaps.length > 0) {
      this.createColorMaps();
    }
  }

  static hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = ColorMapManager.hue2rgb(p, q, h + 1 / 3);
      g = ColorMapManager.hue2rgb(p, q, h);
      b = ColorMapManager.hue2rgb(p, q, h - 1 / 3);
    }
    return [r, g, b];
  }

  componentToHex(c) {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }

  rgbToHex(r, g, b) {
    return '#' + this.componentToHex(r) + this.componentToHex(g) + this.componentToHex(b);
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  createColorMapFromHexValues(hexValues) {
    const colorsMap = [];
    for (let counter = 0; counter < hexValues.length; counter++) {
      const currColor = this.hexToRgb(hexValues[counter]);
      colorsMap.push({
        x: counter / (hexValues.length - 1),
        o: 1.0,
        r: currColor.r / 255,
        g: currColor.g / 255,
        b: currColor.b / 255,
      });
    }
    return colorsMap;
  }

  createColorMapFromXORGB(xorgb) {
    const colorsMap = [];
    for (let i = 0; i < xorgb.length; i++) {
      const currColor = xorgb[i];
      colorsMap.push({
        x: currColor.x,
        o: currColor.o,
        r: currColor.r,
        g: currColor.g,
        b: currColor.b,
      });
    }
    return colorsMap;
  }

  reverseColorMap(colorMap) {
    const colorsMap = [];
    for (let counter = colorMap.length - 1; counter >= 0; counter--) {
      const currColor = colorMap[counter];
      colorsMap.push({
        x: 1 - currColor.x,
        o: currColor.o,
        r: currColor.r,
        g: currColor.g,
        b: currColor.b,
      });
    }
    return colorsMap;
  }

  rainbowColormapCreator(minValue, maxValue, currValue) {
    const hue = 240.0 / 360.0 - ((currValue - minValue) / (maxValue - minValue)) * (240.0 / 360.0);
    return this.hslToRgb(hue, 1.0, 0.5);
  }

  createGradient(colorMap) {
    const gradient = [];
    for (let currPercentage = 0; currPercentage <= 1.0; currPercentage += 0.05) {
      const offsetString = (currPercentage * 100).toString() + '%';
      const currColors = this.customColorMapByPercentage(colorMap, 0.0, 1.0, 1.0 - currPercentage);
      const colorsHex = this.rgbToHex(
        Math.round(currColors[0] * 255),
        Math.round(currColors[1] * 255),
        Math.round(currColors[2] * 255)
      );
      gradient.push({
        Offset: offsetString,
        StopColor: colorsHex,
      });
    }
    return gradient;
  }

  createColorMaps() {
    this.ColorMaps = [];

    // Process raw colormaps from JSON
    for (let i = 0; i < this.RawColorMaps.length; i++) {
      const curr = this.RawColorMaps[i];
      let currColorMap;
      
      if (curr.BuildFunction === 'HEX') {
        currColorMap = this.createColorMapFromHexValues(curr.Values);
      } else if (curr.BuildFunction === 'xorgb') {
        currColorMap = this.createColorMapFromXORGB(curr.Values);
      }

      const idName = curr.FullName.replace(/\|/g, '_').replace(/ /g, '_');
      const gradient = this.createGradient(currColorMap);
      
      this.ColorMaps.push({
        FullName: curr.FullName,
        IdName: idName,
        ColorMap: currColorMap,
        Function: curr.Function,
        Gradient: gradient,
      });

      // Add inverse version
      const reverseColorMap = this.reverseColorMap(currColorMap);
      const reverseGradient = this.createGradient(reverseColorMap);
      this.ColorMaps.push({
        FullName: curr.FullName + ' Inverse',
        IdName: idName + '_Inverse',
        ColorMap: reverseColorMap,
        Function: curr.Function,
        Gradient: reverseGradient,
      });
    }

    // Add rainbow colormap
    const rainbowColormap = [];
    for (let currPercentage = 0.0; currPercentage < 1.01; currPercentage += 0.01) {
      const currValue = this.rainbowColormapCreator(0.0, 1.0, currPercentage);
      const r = currValue[0];
      const g = currValue[1];
      const b = currValue[2];
      rainbowColormap.push({ x: currPercentage, o: 1.0, r, g, b });
    }
    this.ColorMaps.push({
      FullName: 'Other|Rainbow',
      IdName: 'Other_Rainbow',
      ColorMap: rainbowColormap,
      Function: 'customColorMap',
      Gradient: this.createGradient(rainbowColormap),
    });
    this.ColorMaps.push({
      FullName: 'Other|Rainbow Inverse',
      IdName: 'Other_Rainbow_Inverse',
      ColorMap: this.reverseColorMap(rainbowColormap),
      Function: 'customColorMap',
      Gradient: this.createGradient(rainbowColormap),
    });

    // Sort alphabetically
    this.ColorMaps.sort((a, b) => (a.FullName < b.FullName ? -1 : 1));
  }

  /**
   * Get colormap by full name
   */
  getColorMap(colorMapName) {
    const found = this.ColorMaps.find((obj) => obj.FullName === colorMapName);
    return found ? found.ColorMap : null;
  }

  /**
   * Get all available colormap names
   */
  getColorMapNames() {
    return this.ColorMaps.map((cm) => cm.FullName);
  }

  /**
   * Get full colormap objects with gradients
   */
  getColorMaps() {
    return this.ColorMaps;
  }

  /**
   * Main interpolation function for a colormap
   */
  customColorMap(colormap, minValue, maxValue, currValue) {
    const valueScaled = (currValue - minValue) / (maxValue - minValue);
    let lowerColor, upperColor, percentFade;

    if (currValue < minValue) {
      lowerColor = [colormap[0].r, colormap[0].g, colormap[0].b];
      upperColor = [colormap[0].r, colormap[0].g, colormap[0].b];
      percentFade = 1.0;
    } else if (currValue > maxValue) {
      const curLoc = colormap.length - 1;
      lowerColor = [colormap[curLoc].r, colormap[curLoc].g, colormap[curLoc].b];
      upperColor = [colormap[curLoc].r, colormap[curLoc].g, colormap[curLoc].b];
      percentFade = 1.0;
    } else {
      for (let i = 1; i < colormap.length; i++) {
        if (valueScaled >= colormap[i - 1].x && valueScaled <= colormap[i].x) {
          lowerColor = [colormap[i - 1].r, colormap[i - 1].g, colormap[i - 1].b];
          upperColor = [colormap[i].r, colormap[i].g, colormap[i].b];
          percentFade = (valueScaled - colormap[i - 1].x) / (colormap[i].x - colormap[i - 1].x);
          break;
        }
      }
    }

    let diffRed = upperColor[0] - lowerColor[0];
    let diffGreen = upperColor[1] - lowerColor[1];
    let diffBlue = upperColor[2] - lowerColor[2];
    diffRed = diffRed * percentFade + lowerColor[0];
    diffGreen = diffGreen * percentFade + lowerColor[1];
    diffBlue = diffBlue * percentFade + lowerColor[2];
    return [diffRed, diffGreen, diffBlue];
  }

  customColorMapByPercentage(colormap, minValue, maxValue, percentage) {
    const currValue = (maxValue - minValue) * percentage + minValue;
    return this.customColorMap(colormap, minValue, maxValue, currValue);
  }

  /**
   * Generate 256 RGBA strings for a colormap name (compatible with existing usage)
   */
  generateRGBAStrings(colorMapName, nshades = 256) {
    let colorMap = this.getColorMap(colorMapName);
    if (!colorMap) {
      console.warn(`Colormap "${colorMapName}" not found. Available colormaps:`, this.getColorMapNames().slice(0, 10));
      // Try fallbacks
      const fallbacks = ['Matlab|Jet', 'Matlab|Hot', 'Color Brewer 2.0|Sequential|Multi-Hue|9-class YlGnBu', 'Other|Rainbow'];
      for (const fallback of fallbacks) {
        colorMap = this.getColorMap(fallback);
        if (colorMap) {
          console.warn(`Using fallback colormap: ${fallback}`);
          break;
        }
      }
      // If still not found, generate grayscale
      if (!colorMap) {
        console.error('No colormaps available, using grayscale fallback');
        return this.generateGrayscaleFallback(nshades);
      }
    }

    const colors = [];
    for (let i = 0; i < nshades; i++) {
      const percentage = i / (nshades - 1);
      const rgb = this.customColorMapByPercentage(colorMap, 0.0, 1.0, percentage);
      const r = Math.round(rgb[0] * 255);
      const g = Math.round(rgb[1] * 255);
      const b = Math.round(rgb[2] * 255);
      colors.push(`rgba(${r},${g},${b},1)`);
    }
    return colors;
  }

  generateGrayscaleFallback(nshades) {
    const colors = [];
    for (let i = 0; i < nshades; i++) {
      const val = Math.round((i / (nshades - 1)) * 255);
      colors.push(`rgba(${val},${val},${val},1)`);
    }
    return colors;
  }
}

// Singleton instance
let colorMapManagerInstance = null;

/**
 * Initialize the ColorMapManager with JSON data
 */
export async function initializeColorMapManager() {
  if (colorMapManagerInstance) {
    return colorMapManagerInstance;
  }

  try {
    const response = await fetch('/assets/colorMaps.json');
    const colorMapsData = await response.json();
    colorMapManagerInstance = new ColorMapManager(colorMapsData);
    console.log('ColorMapManager initialized with', colorMapManagerInstance.ColorMaps.length, 'colormaps');
    return colorMapManagerInstance;
  } catch (error) {
    console.error('Failed to load colorMaps.json:', error);
    colorMapManagerInstance = new ColorMapManager([]);
    return colorMapManagerInstance;
  }
}

/**
 * Get the singleton instance (must be initialized first)
 */
export function getColorMapManager() {
  if (!colorMapManagerInstance) {
    throw new Error('ColorMapManager not initialized. Call initializeColorMapManager() first.');
  }
  return colorMapManagerInstance;
}

export default ColorMapManager;
