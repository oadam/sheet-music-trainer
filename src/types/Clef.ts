export interface Clef {
  readonly firstVecflowClef: "treble" | "bass";
  readonly secondVecflowClef: "treble" | "bass" | undefined;
  encodeNote(note: number): string;
  getMinNote(extraBars: number): number;
  getMaxNote(extraBars: number): number;
  getNotePosition(note: number): "first" | "second";
}

export const TREBLE: Clef = {
  firstVecflowClef: "treble",
  secondVecflowClef: undefined,
  encodeNote: (note: number) => `treble-${note}`,
  getMinNote: (extraBars: number) => 30 - 2 * extraBars,
  getMaxNote: (extraBars: number) => 30 + 8 + 2 * extraBars,
  getNotePosition: (_note: number) => "first",
};

export const BASS: Clef = {
  firstVecflowClef: "bass",
  secondVecflowClef: undefined,
  encodeNote: (note: number) => `bass-${note}`,
  getMinNote: (extraBars: number) => 18 - 2 * extraBars,
  getMaxNote: (extraBars: number) => 18 + 8 + 2 * extraBars,
  getNotePosition: (_note: number) => "first",
};

export const BOTH: Clef = {
  firstVecflowClef: "treble",
  secondVecflowClef: "bass",
  encodeNote: (note: number) => (note < 28 ? `bass-${note}` : `treble-${note}`),
  getMinNote: (extraBars: number) => BASS.getMinNote(extraBars),
  getMaxNote: (extraBars: number) => TREBLE.getMaxNote(extraBars),
  getNotePosition: (note: number) => (note < 28 ? "second" : "first"),
};
