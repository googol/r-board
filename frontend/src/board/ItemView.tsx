import * as H from "harmaja";
import { componentScope, h } from "harmaja";
import * as L from "lonna";
import { BoardCoordinateHelper } from "./board-coordinates"
import { Board, Id, Note, ItemLocks, Item, Text, ItemType } from "../../../common/domain";
import { EditableSpan } from "../components/components"
import { BoardFocus } from "./BoardView";
import { ContextMenu } from "./ContextMenuView"
import { SelectionBorder } from "./SelectionBorder"
import { itemDragToMove } from "./item-dragmove"
import { itemSelectionHandler } from "./item-selection";
import { Dispatch } from "./board-store";
import _ from "lodash"

export const ItemView = (
    { board, id, type, item, locks, userId, focus, coordinateHelper, dispatch, contextMenu }:
    {  
        board: L.Property<Board>, id: string; type: string, item: L.Property<Item>,
        locks: L.Property<ItemLocks>,
        userId: L.Property<Id | null>,
        focus: L.Atom<BoardFocus>,
        coordinateHelper: BoardCoordinateHelper, dispatch: Dispatch,
        contextMenu: L.Atom<ContextMenu>
    }
) => {
  const element = L.atom<HTMLElement | null>(null)
  let referenceFont: string | null = null
  const ref = (el: HTMLElement) => {
     itemDragToMove(id, board, focus, coordinateHelper, dispatch)(el)
     element.set(el)
     referenceFont = getComputedStyle(el).font
  }

  const { itemFocus, selected, onClick } = itemSelectionHandler(id, focus, contextMenu, board, userId, locks, dispatch)

  function onContextMenu(e: JSX.MouseEvent) {
    onClick(e)
    const { x, y } = coordinateHelper.currentClientCoordinates.get()
    contextMenu.set({ hidden: false, x: x, y: y})
    e.preventDefault()
  }

  const dataTest = L.combineTemplate({
    text: L.view(item, i => i.type === "note" || i.type === "text" ? i.text : ""),
    type: L.view(item, "type"),
    selected
  }).pipe(L.map(({ text, selected, type }: { text: string, selected: boolean, type: ItemType }) => {
    const textSuffix = text ? "-" + text : ""
    return selected ? `${type}-selected${textSuffix}` : `${type}${textSuffix}`
  }))


  return (
    <span
      ref={ref}
      data-test={dataTest}
      draggable={true}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={L.view(selected, s => s ? type + " selected" : type)}
      style={item.pipe(L.map((p: Item) => ({
        top: p.y + "em",
        left: p.x + "em",
        height: p.height + "em",
        width: p.width + "em",
        background: p.type === "note" ? p.color : "none",
        position: "absolute"        
      })))}      
    >
      { (type === "note" || type === "text") ? <TextView item={item as L.Property<Note | Text>}/> : null }
      { L.view(locks, l => l[id] && l[id] !== userId.get() ? <span className="lock">🔒</span> : null )}
      { L.view(selected, s => s ? <SelectionBorder {...{ id, item: item, coordinateHelper, board, focus, dispatch}}/> : null) }
    </span>
  );

  function TextView({ item } : { item: L.Property<Note | Text>} ) {
    const textAtom = L.atom(L.view(item, "text"), text => dispatch({ action: "item.update", boardId: board.get().id, item: { ...item.get(), text } }))
    const showCoords = false
  
    const fontSize = L.view(L.view(item, "width"), L.view(item, "height"), L.view(item, "text"), (w, h, text) => {
      const lines = text.split(/\s/).map(s => s.trim()).filter(s => s).map(s => getTextDimensions(s, referenceFont!))      

      const textHeight = _.sum(lines.map(l => l.height))
      const textWidth = _.max(lines.map(l => l.width)) || 0            
      const width = coordinateHelper.emToPx(w)
      const height = coordinateHelper.emToPx(h)

      let size = 0
      for (let wpl = 1; wpl < 20; wpl++) { // try different numbers of words-per-line
        const thisSize = Math.min(width/textWidth/wpl*0.6, height/textHeight*0.8*wpl)
        if (thisSize < size) {
            break
        }
        size = thisSize
      }

      return size + "em"
    })

    const setEditingIfAllowed = (e: boolean) => {
      const l = locks.get()
      const u = userId.get()
  
      if (!u) return
      if (l[id] && l[id] !== u) return
      focus.set(e ? { status: "editing", id } : { status: "selected", ids: new Set([id]) })
  
      !l[id] && dispatch({ action: "item.lock", boardId: board.get().id, itemId: id })
    }
  
    return <span className="text" style={ L.combineTemplate({fontSize}) }>
      <EditableSpan {...{
        value: textAtom, editingThis: L.atom(
            L.view(itemFocus, f => f === "editing"),
            setEditingIfAllowed
        )
      }} />
      { showCoords ? <small>{L.view(item, p => Math.floor(p.x) + ", " + Math.floor(p.y))}</small> : null}
    </span>
  }
};

export function getTextDimensions(text: string, font: string) {
  // if given, use cached canvas for better performance
  // else, create new canvas
  var gtw: any = getTextDimensions
  var canvas: HTMLCanvasElement = gtw.canvas || (gtw.canvas = document.createElement("canvas"));
  var context = canvas.getContext("2d")!;
  context.font = font;
  var metrics = context.measureText(text);
  const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
  const width = metrics.width
  
  return { height, width };
};