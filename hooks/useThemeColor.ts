import { useColorScheme } from '@/hooks/useColorScheme';

const THEME_COLORS = {
  light: {
    background: '#ffffff',
    text: '#11181C',
    icon: '#687076',
    tint: '#0a7ea4',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
  },
  dark: {
    background: '#151718',
    text: '#ECEDEE',
    icon: '#9BA1A6',
    tint: '#fff',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#fff',
  },
};

type ThemeColorKey = keyof typeof THEME_COLORS.light;

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: ThemeColorKey,
): string {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];
  if (colorFromProps) return colorFromProps;
  return THEME_COLORS[theme][colorName];
}
