import { useEffect, useRef } from 'react';

// Phone back gesture closes the top open layer (dialog, drawer, menu) instead of leaving the page.
// Each open layer owns one history entry; closing it from the UI pops that entry again.

const session = Math.random().toString(36).slice(2, 8);
const layers = [];
const waiting = [];
let ownPops = 0;
let seq = 0;

function pushEntry(layer) {
  window.history.pushState({ ...window.history.state, __layer: layer.id }, '');
  layer.pushed = true;
}

function popOwn() {
  ownPops += 1;
  window.history.back();
}

function onPopState() {
  if (ownPops > 0) {
    ownPops -= 1;
  } else {
    const top = layers[layers.length - 1];
    if (top?.pushed) {
      layers.pop();
      top.pushed = false;
      top.close();
    }
  }
  if (ownPops > 0) return;
  const id = window.history.state?.__layer;
  if (id && !layers.some(l => l.pushed && l.id === id)) {
    popOwn();
    return;
  }
  while (waiting.length) {
    const layer = waiting.shift();
    if (layers.includes(layer)) pushEntry(layer);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', onPopState);
  if (window.history.state?.__layer) popOwn();
}

function acquire(layer) {
  layers.push(layer);
  if (ownPops > 0) waiting.push(layer);
  else pushEntry(layer);
}

function release(layer) {
  const i = layers.indexOf(layer);
  if (i !== -1) layers.splice(i, 1);
  const w = waiting.indexOf(layer);
  if (w !== -1) waiting.splice(w, 1);
  if (!layer.pushed) return;
  layer.pushed = false;
  if (window.history.state?.__layer === layer.id) popOwn();
}

export default function useBackClose(open, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const layer = { id: `${session}-${++seq}`, pushed: false, close: () => closeRef.current?.() };
    acquire(layer);
    return () => release(layer);
  }, [open]);
}
