/** Ana disiplinler için düşük doygunlukta, eşit aralıklı tonlar (yön bulmaya yardımcı, dekoratif değil). */
export function disciplineHue(index: number, total: number): number {
  return Math.round((index * 360) / Math.max(total, 1) + 210) % 360;
}

export function disciplineColor(index: number, total: number, dark: boolean): string {
  const h = disciplineHue(index, total);
  return dark ? `hsl(${h}, 32%, 62%)` : `hsl(${h}, 38%, 42%)`;
}
