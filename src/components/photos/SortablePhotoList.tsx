import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface SortablePhotoListProps {
  photos: string[];
  onReorder: (newOrder: string[]) => void;
  renderItem: (url: string, index: number, dragHandle: React.ReactNode) => React.ReactNode;
  disabled?: boolean;
}

function SortableItem({ id, index, renderItem, disabled }: {
  id: string;
  index: number;
  renderItem: (url: string, index: number, dragHandle: React.ReactNode) => React.ReactNode;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const dragHandle = !disabled ? (
    <button
      className="absolute top-2 left-2 z-10 p-1 rounded bg-background/80 border border-border shadow-sm cursor-grab active:cursor-grabbing hover:bg-background transition-colors"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="w-4 h-4 text-muted-foreground" />
    </button>
  ) : null;

  return (
    <div ref={setNodeRef} style={style}>
      {renderItem(id, index, dragHandle)}
    </div>
  );
}

export default function SortablePhotoList({ photos, onReorder, renderItem, disabled }: SortablePhotoListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = photos.indexOf(active.id as string);
      const newIndex = photos.indexOf(over.id as string);
      const newPhotos = [...photos];
      newPhotos.splice(oldIndex, 1);
      newPhotos.splice(newIndex, 0, active.id as string);
      onReorder(newPhotos);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={photos} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {photos.map((url, i) => (
            <SortableItem key={url} id={url} index={i} renderItem={renderItem} disabled={disabled} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
