import {h} from "harmaja"
import * as L from "lonna"
import _ from "lodash"
import {Board, Color, isColoredItem, Item, Note} from "../../../common/src/domain"
import { Dispatch } from "../store/board-store"
import { NOTE_COLORS } from "./PaletteView"
import { BoardFocus, getSelectedIds } from "./board-focus"
import { getItem } from "../../../common/src/state"

export const ContextMenuView = (
  { latestNote, dispatch, board, focus }:
  { latestNote: L.Atom<Note>, dispatch: Dispatch, board: L.Property<Board>, focus: L.Property<BoardFocus> }
) => {

  const focusedItems = L.view(focus, f => {
    switch (f.status) {
      case "dragging": return []
      case "editing": return [f.id]
      case "none": return []
      case "selected": return [...f.ids]
    }
  }, ids => ids.map(getItem(board.get())));

  const focusItem = L.view(focusedItems, items => {
    if (items.length === 0) return null
    return { 
      x: _.mean(items.map(i => i.x)),
      y: _.min(items.map(i => i.y))
    }
  })

  const widgetCreators = [ menuColors() ]
  const activeWidgets = L.view(L.combineAsArray(widgetCreators), arrays => arrays.flat())

  return L.view(activeWidgets, ws => ws.length === 0, hide => hide ? null : (
    <div className="context-menu-positioner" style={L.combineTemplate({
      left: L.view(focusItem, p => p ? p.x + "em" : 0),
      top: L.view(focusItem, p => p ? p.y + "em" : 0)
    })}>
    <div className="context-menu">      
      { activeWidgets }      
    </div>
    </div>
  ))

  function menuColors() {
    const coloredItems = L.view(focusedItems, items => items.filter(isColoredItem))
    const anyColored = L.view(coloredItems, items => items.length > 0)

    return L.view(anyColored, any => !any 
      ? []
      : [<div className="colors">
          {NOTE_COLORS.map(color => {
            return <span className={"color " + color} style={{background: color}} onClick={() => setColor(color)}/>            
          })}
        </div>
        ]
    )
  
    function setColor(color: Color) {
      const f = focus.get();
      const b = board.get();

      // To remember color selection for creating new notes.
      latestNote.modify(n => ({...n, color }))
  
      const updated = coloredItems.get().map(item => ({ ...item, color }))
      dispatch({ action: "item.update", boardId: b.id, items: updated  });
    }
  }
}