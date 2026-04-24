import { Platform } from 'react-native';

const tintColorLight = '#D82E3F'; // Traditional Japanese Red (Aka)
const tintColorDark = '#FF4D4D';

export const Colors = {
  light: {
    background: '#FBEAD6', // 60% Champagne
    surface: '#F0C4CB',    // 30% Blush
    primary: '#C87D87',    // 10% Antique Rose
    tint: '#C87D87',
    secondary: '#F0C4CB',
    text: '#7A5560',       // Body Mauve
    heading: '#4A2C35',    // Heading Mauve
    icon: '#C87D87',
    tabIconDefault: '#7A5560',
    tabIconSelected: '#C87D87',
    border: '#F0C4CB',
    gray: '#F0C4CB',
    white: '#FBEAD6',      // Champagne instead of white
    black: '#4A2C35',      // Mauve instead of black
    shadow: 'rgba(200, 125, 135, 0.15)',
  },
  dark: {
    background: '#4A2C35', // Dark Mauve
    surface: '#7A5560',
    primary: '#C87D87',
    tint: '#C87D87',
    secondary: '#F0C4CB',
    text: '#FBEAD6',       // Champagne
    heading: '#FBEAD6',
    icon: '#C87D87',
    tabIconDefault: '#F0C4CB',
    tabIconSelected: '#C87D87',
    border: '#7A5560',
    gray: '#7A5560',
    white: '#FBEAD6',
    black: '#4A2C35',
    shadow: 'rgba(0, 0, 0, 0.25)',
  },
};

export const Typography = {
  h1: 'ShipporiMincho-ExtraBold',
  h2: 'ShipporiMincho-Bold',
  body: 'Outfit-Regular',
  button: 'Outfit-Bold',
  brand: 'YujiBoku-Regular',
  logo: 'ShipporiMincho-ExtraBold',
};

export const Fonts = Platform.select({
  ios: {
    sans: 'Outfit-Regular',
    serif: 'ShipporiMincho-Regular',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'Outfit-Regular',
    serif: 'ShipporiMincho-Regular',
    rounded: 'normal',
    mono: 'monospace',
  },
});
