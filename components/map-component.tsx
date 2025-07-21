"use client"

import { useEffect, useRef } from "react"
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet"
import L from "leaflet"


interface LocationData {
  latitude: number
  longitude: number
  timestamp: string
}


const carIcon = new L.Icon({
  iconUrl: "/car-icon.png", 
  iconSize: [32, 32], 
  iconAnchor: [16, 32], 
  popupAnchor: [0, -32], 
})


function MapUpdater({
  currentVehiclePosition, 
  traversedPath,
  initialCenter,
}: {
  currentVehiclePosition: LocationData | null
  traversedPath: [number, number][]
  initialCenter: [number, number]
}) {
  const map = useMap()
  const markerRef = useRef<L.Marker | null>(null)

 
  useEffect(() => {
    if (currentVehiclePosition) {
      const newLatLng: L.LatLngExpression = [currentVehiclePosition.latitude, currentVehiclePosition.longitude]
      if (markerRef.current) {
        markerRef.current.setLatLng(newLatLng)
      }
      
      map.panTo(newLatLng, { animate: true, duration: 0.5 }) 
    }
  }, [currentVehiclePosition, map])

 
  useEffect(() => {
    if (initialCenter && map) {
      map.setView(initialCenter, 15) 
    }
  }, [initialCenter, map])

  return (
    <>
      {/* Render the vehicle marker */}
      {currentVehiclePosition && (
        <Marker
          position={[currentVehiclePosition.latitude, currentVehiclePosition.longitude]}
          icon={carIcon}
          ref={markerRef}
        />
      )}
      {/* Draw the traversed path as a blue polyline */}
      <Polyline positions={traversedPath} color="#3b82f6" weight={5} />
    </>
  )
}


export function MapWrapper({
  currentVehiclePosition,
  traversedPath,
  initialCenter,
}: {
  currentVehiclePosition: LocationData | null
  traversedPath: [number, number][]
  initialCenter: [number, number] | null
}) {
 
  if (!initialCenter) return null

  return (
    <MapContainer
      center={initialCenter}
      zoom={15}
      scrollWheelZoom={true}
      className="flex-1 z-0"
      style={{ height: "100%", width: "100%" }}
    >
      {/* OpenStreetMap Tile Layer */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* MapUpdater handles marker and polyline updates */}
      <MapUpdater
        currentVehiclePosition={currentVehiclePosition}
        traversedPath={traversedPath}
        initialCenter={initialCenter}
      />
    </MapContainer>
  )
}
