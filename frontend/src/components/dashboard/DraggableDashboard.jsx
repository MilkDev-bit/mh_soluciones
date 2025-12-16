import React, { useState, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy
} from '@dnd-kit/sortable';
import SortableItem from './SortableItem';
import './DraggableDashboard.scss';

const DraggableDashboard = ({ items, onOrderChange, renderItem }) => {
    const [activeId, setActiveId] = useState(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            const oldIndex = items.findIndex((item) => item.id === active.id);
            const newIndex = items.findIndex((item) => item.id === over.id);

            const newOrder = arrayMove(items, oldIndex, newIndex);
            onOrderChange(newOrder);
        }

        setActiveId(null);
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <SortableContext items={items} strategy={rectSortingStrategy}>
                <div className="draggable-dashboard-grid">
                    {items.map((item) => (
                        <SortableItem key={item.id} id={item.id} className={`dashboard-item ${item.type || 'default'}`}>
                            {renderItem(item)}
                            {/* Add a subtle drag handle indicator if needed, though the whole card is draggable */}
                        </SortableItem>
                    ))}
                </div>
            </SortableContext>

            {/* Optional: DragOverlay for smoother lifting animation if needed, 
          but simplest implementation is direct SortableItem manipulation first. 
      */}
        </DndContext>
    );
};

export default DraggableDashboard;
