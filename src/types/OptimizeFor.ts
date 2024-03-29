export interface Guess {
  failed: boolean;
  duration: number;
}

export interface OptimizeFor {
  getGuessBadness(guess: Guess): number;
  getBadnessDescription(value: number): string;
  getWorstBadness(badnesses: Iterable<number>): number;
  getBestBadness(badnesses: Iterable<number>): number;
}

export const OptimizeForAccuracy: OptimizeFor = {
  getGuessBadness(guess) {
    return guess.failed ? 1 : 0;
  },
  getBadnessDescription(value: number) {
    return (100 - 100 * value).toFixed(0) + "%";
  },
  getWorstBadness(_badnesses: Iterable<number>) {
    return 1;
  },
  getBestBadness(_badnesses: Iterable<number>) {
    return 0;
  },
};

export class OptimizeForSpeed implements OptimizeFor {
  public constructor(private badGuessTime: number) {}

  getGuessBadness(guess: Guess) {
    return guess.failed
      ? this.badGuessTime
      : Math.min(this.badGuessTime, guess.duration);
  }
  getBadnessDescription(value: number) {
    return value.toFixed(2) + "s";
  }
  getWorstBadness(badnesses: Iterable<number>) {
    return Math.max(...badnesses);
  }
  getBestBadness(badnesses: Iterable<number>) {
    return Math.min(...badnesses);
  }
}
