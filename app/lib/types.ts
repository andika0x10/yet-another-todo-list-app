export type CardStatus = "active" | "archived";

export interface Card {
  id: string;
  title: string;
  body: string;
  status: CardStatus;
  position: number;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
}
