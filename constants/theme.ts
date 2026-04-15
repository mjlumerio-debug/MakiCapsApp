import { Platform } from 'react-native';

const tintColorLight = '#D82E3F'; // Traditional Japanese Red (Aka)
const tintColorDark = '#FF4D4D';

export const Colors = {
  light: {
    text: '#000000',
    background: '#FFFFFF',
    tint: tintColorLight,
    icon: '#1A1A1A',
    tabIconDefault: '#1A1A1A',
    tabIconSelected: tintColorLight,
    primary: tintColorLight,
    secondary: '#000000',
    gray: '#F8F8F8',
    border: '#E8E8E8',
    white: '#FFFFFF',
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000',
    tint: tintColorDark,
    icon: '#FFFFFF',
    tabIconDefault: '#FFFFFF',
    tabIconSelected: tintColorDark,
    primary: tintColorDark,
    secondary: '#FFFFFF',
    gray: '#1A1A1A',
    border: '#333333',
    white: '#FFFFFF',
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
