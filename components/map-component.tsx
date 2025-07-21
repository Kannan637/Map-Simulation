"use client"

import { useEffect, useRef } from "react"
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet"
import L from "leaflet"

// Define types for location data
interface LocationData {
  latitude: number
  longitude: number
  timestamp: string
}

// Custom car icon using the provided image
const carIcon = new L.Icon({
  iconUrl: "/car-icon.png", // Updated to use the new car.png
  iconSize: [32, 32], // Size of the icon
  iconAnchor: [16, 32], // Point of the icon which will correspond to marker's location
  popupAnchor: [0, -32], // Point from which popups will "open", relative to the icon anchor
})

/**
 * MapUpdater component handles updating the map, marker, and polyline.
 * It uses `useMap` to access the Leaflet map instance.
 */
function MapUpdater({
  currentVehiclePosition, // Renamed for clarity (interpolated position)
  traversedPath,
  initialCenter,
}: {
  currentVehiclePosition: LocationData | null
  traversedPath: [number, number][]
  initialCenter: [number, number]
}) {
  const map = useMap()
  const markerRef = useRef<L.Marker | null>(null)

  // Effect to update marker position and pan the map
  useEffect(() => {
    if (currentVehiclePosition) {
      const newLatLng: L.LatLngExpression = [currentVehiclePosition.latitude, currentVehiclePosition.longitude]
      if (markerRef.current) {
        markerRef.current.setLatLng(newLatLng)
      }
      // Pan the map to follow the car with a smooth animation
      map.panTo(newLatLng, { animate: true, duration: 0.5 }) // Slightly faster pan for smoother follow
    }
  }, [currentVehiclePosition, map])

  // Effect to set the initial map view when the map is ready
  useEffect(() => {
    if (initialCenter && map) {
      map.setView(initialCenter, 15) // Set initial zoom level to 15
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

/**
 * MapWrapper component dynamically imports Leaflet components to prevent SSR issues.
 * It renders the MapContainer and passes props to MapUpdater.
 */
export function MapWrapper({
  currentVehiclePosition,
  traversedPath,
  initialCenter,
}: {
  currentVehiclePosition: LocationData | null
  traversedPath: [number, number][]
  initialCenter: [number, number] | null
}) {
  // Do not render the map until the initial center is determined from data
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
