import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CardComponent from './CardComponent';
import { Card } from '../types';

interface Props {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
  groupLabel?: string;
  isDrawnCard?: boolean;
}

export default function SortableCard({ card, selected, onClick, groupLabel, isDrawnCard }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardComponent card={card} selected={selected} onClick={onClick} groupLabel={groupLabel} isDrawnCard={isDrawnCard} />
    </div>
  );
}
