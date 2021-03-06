import * as L from "lonna";
import { AppEvent, AssetPutUrlResponse } from "../../../common/src/domain";
import { BoardStore } from "./board-store";
import md5 from "md5"

export type AssetId = string
export type AssetURL = string

export function assetStore(socket: typeof io.Socket, store: BoardStore) {
    let dataURLs: Record<AssetId, AssetURL> = {}


    function assetExists(assetId: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (store.state.get().board!.items.find(i => i.type === "image" && i.assetId === assetId && i.src)) {
                resolve(true)
            }
            const img = new Image()
            img.onload = () => resolve(true)
            img.onerror = () => resolve(false)        
            img.src = assetURL(assetId)
        })
    }


    function uploadAsset(file: File): Promise<[AssetId, Promise<AssetURL>]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.addEventListener("loadend", async x => {
                if (typeof reader.result !== "string") {
                    throw Error("Unexpected result type " + reader.result)
                }
                const dataURL = reader.result
                const assetId = md5(dataURL) 
                dataURLs[assetId] = dataURL
                
                resolve([assetId, (async () => {
                    const exists = await assetExists(assetId)
                    const url = assetURL(assetId)
                    if (exists) {
                        return url
                    }
                    socket.send("app-event", { action: "asset.put.request", assetId })
                    const signedUrl = await getAssetPutResponse(assetId, store.events)

                    const response = await fetch(signedUrl, {
                        method: "PUT",
                        body: file,
                    })
                    if (response.ok) {                                
                        return url                               
                    } else {
                        console.error("Asset PUT failed", response)
                        throw Error("Asset PUT failed with " + response.status)
                    }
                })()]) 
            })
            reader.addEventListener("error", x => {
                console.error("File import fail" + x)
                reject(x)
            })    
        })
    }

    function getExternalAssetAsBytes(url: string) {
        return fetch(`/assets/external?src=${encodeURI(url)}`)
    }

    function getAsset(assetId: string, src?: string): AssetURL {
        if (src) return src
        const local = dataURLs[assetId]
        if (local) return local
        // When src is not set and asset not found locally, it indicates that this image was added by
        // some other user and image upload is not complete yet. (src will be set on completion)
        // Currently returned image URL if currently a 404 which results to a temporary "broken image"
        // Shown to other users while upload in progress (this is not bad, but could be better)
        // TODO: show a progress indicator instead. 
        return `/not-uploaded-yet.png` 
    }

    return {
        getAsset,
        uploadAsset,
        getExternalAssetAsBytes
    }
}

function getAssetPutResponse(assetId: string, events: L.EventStream<AppEvent>): Promise<AssetURL> {
    return new Promise((resolve, reject) => {
        events.pipe(L.filter((e: AppEvent) => e.action == "asset.put.response"), L.take(1))
                    .forEach(async e => { // TODO: filter with type narrowing in Lonna would be super nice
                        const signedUrl = (e as AssetPutUrlResponse).signedUrl
                        resolve(signedUrl)
                    })
    })
}

export type AssetStore = ReturnType<typeof assetStore>

const STORAGE_URL = process.env.AWS_ASSETS_BUCKET_URL || "/assets"
function assetURL(assetId: string) {
    return `${STORAGE_URL}/${assetId}`
}