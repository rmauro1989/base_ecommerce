"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState, useTransition } from "react";
import { ProductImage } from "@/components/store/product-image";
import { cn } from "@/lib/cn";
import { uploadImagesAction } from "../actions";

export type ImageItem = { assetId: string; url: string; alt: string };

function SortableImage({ item, index, onRemove, onAlt }: { item: ImageItem; index: number; onRemove: () => void; onAlt: (v: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.assetId });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("flex flex-col gap-1 rounded-md border border-border bg-surface p-2", isDragging && "z-10 shadow-lg")}>
      <button type="button" {...attributes} {...listeners} className="cursor-grab touch-none active:cursor-grabbing" aria-label={`Mover foto ${index + 1}`}>
        <ProductImage src={item.url} alt={item.alt} sizes="160px" className="rounded-sm" />
      </button>
      {index === 0 ? <span className="text-center text-xs font-semibold text-primary">Principal</span> : null}
      <input value={item.alt} onChange={(e) => onAlt(e.target.value)} placeholder="Texto alternativo" className="h-8 rounded-sm border border-border px-2 text-xs" aria-label="Texto alternativo" />
      <button type="button" onClick={onRemove} className="text-xs text-danger underline">
        Quitar
      </button>
    </li>
  );
}

export function ImageManager({ images, onChange, onUploadingChange }: { images: ImageItem[]; onChange: (next: ImageItem[]) => void; onUploadingChange?: (uploading: boolean) => void }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, startUpload] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const upload = (files: FileList | File[]) => {
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    onUploadingChange?.(true);
    startUpload(async () => {
      // Una foto por envío (límite de tamaño de las server actions)
      const added: ImageItem[] = [];
      const errs: string[] = [];
      try {
        for (const f of list) {
          const fd = new FormData();
          fd.set("kind", "product");
          fd.append("files", f);
          const r = await uploadImagesAction(fd).catch(() => ({ ok: false as const, message: `${f.name}: no se pudo subir.` }));
          if (!r.ok) errs.push(r.message);
          else {
            errs.push(...r.errors);
            added.push(...r.assets.map((a) => ({ assetId: a.id, url: a.url, alt: "" })));
          }
        }
        setErrors(errs);
        if (added.length) onChange([...images, ...added]);
      } finally {
        onUploadingChange?.(false);
      }
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = images.findIndex((i) => i.assetId === e.active.id);
    const to = images.findIndex((i) => i.assetId === e.over!.id);
    onChange(arrayMove(images, from, to));
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          upload(e.dataTransfer.files);
        }}
        className={cn("flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center text-sm", dragOver ? "border-primary bg-primary-soft" : "border-border-strong")}
      >
        <p>{uploading ? "Subiendo y optimizando…" : "Arrastra fotos aquí"}</p>
        <button type="button" onClick={() => inputRef.current?.click()} className="font-semibold text-primary underline" disabled={uploading}>
          o elige archivos
        </button>
        <p className="text-xs text-muted">JPG, PNG o WebP · hasta 8 MB · se convierten a WebP</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {errors.length ? (
        <ul className="text-sm text-danger">
          {errors.map((er) => (
            <li key={er}>{er}</li>
          ))}
        </ul>
      ) : null}
      {images.length ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={images.map((i) => i.assetId)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {images.map((img, i) => (
                <SortableImage
                  key={img.assetId}
                  item={img}
                  index={i}
                  onRemove={() => onChange(images.filter((x) => x.assetId !== img.assetId))}
                  onAlt={(alt) => onChange(images.map((x) => (x.assetId === img.assetId ? { ...x, alt } : x)))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : null}
      {images.length > 1 ? <p className="text-xs text-muted">Arrastra para ordenar. La primera es la foto principal.</p> : null}
    </div>
  );
}
