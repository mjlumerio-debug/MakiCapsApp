import { Platform } from 'react-native';

const tintColorLight = '#D82E3F'; // Traditional Japanese Red (Aka)
const tintColorDark = '#FF4D4D';

export const Colors = {
  light: {
    background: '#FFFFFF', // 60% White
    surface: '#F8F8F8',    // 30% Off-white
    primary: '#D38C9D',    // Cherry Soda Pink
    tint: '#D38C9D',
    secondary: '#F8F8F8',
    text: '#4A4A4A',       // Dark Gray
    heading: '#000000',    // Black
    icon: '#D38C9D',
    tabIconDefault: '#A1A1A1',
    tabIconSelected: '#D38C9D',
    border: '#EEEEEE',
    gray: '#A1A1A1',
    white: '#FFFFFF',
    black: '#000000',
    shadow: 'rgba(211, 140, 157, 0.1)',
  },
  dark: {
    background: '#000000', // 60% Black
    surface: '#1A1A1A',    // 30% Dark Gray
    primary: '#B90504',    // 10% Red
    tint: '#B90504',
    secondary: '#1A1A1A',
    text: '#E0E0E0',       // Light Gray
    heading: '#FFFFFF',    // White
    icon: '#B90504',
    tabIconDefault: '#555555',
    tabIconSelected: '#B90504',
    border: '#333333',
    gray: '#555555',
    white: '#FFFFFF',
    black: '#000000',
    shadow: 'rgba(185, 5, 4, 0.2)',
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
