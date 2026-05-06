export type PosterSummary = {
  id: string;
  title: string;
  prompt: string;
  image: string;
  createdAt: string;
  language?: string;
  ttsVoice?: string;
};

export type PosterSection = {
  id: string;
  label: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Poster = PosterSummary & {
  sections: PosterSection[];
};

export type PosterIndex = {
  posters: PosterSummary[];
};
