"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Play, Pause } from "lucide-react"

// Dynamically import MapWrapper to prevent SSR issues with Leaflet
const MapWrapper = dynamic(() => import("@/components/map-component").then((mod) => mod.MapWrapper), { ssr: false })

// Define types for location data
interface LocationData {
  latitude: number
  longitude: number
  timestamp: string
}

/**
 * Calculates the distance between two geographical points using the Haversine formula.
 * @param lat1 Latitude of the first point in degrees.
 * @param lon1 Longitude of the first point in degrees.
 * @param lat2 Latitude of the second point in degrees.
 * @param lon2 Longitude of the second point in degrees.
 * @returns Distance in meters.
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's mean radius in meters
  const φ1 = (lat1 * Math.PI) / 180 // Convert latitude to radians
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180 // Latitude difference in radians
  const Δλ = ((lon2 - lon1) * Math.PI) / 180 // Longitude difference in radians

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

export default function VehicleMovementMap() {
  const [locations, setLocations] = useState<LocationData[]>([])
  const [currentLocationIndex, setCurrentLocationIndex] = useState(0) // Index of the *target* dummy point
  const [currentInterpolatedLocation, setCurrentInterpolatedLocation] = useState<LocationData | null>(null) // Actual position of the vehicle marker
  const [isPlaying, setIsPlaying] = useState(false)

  const animationFrameId = useRef<number | null>(null)
  const segmentStartTimeRef = useRef<DOMHighResTimeStamp | null>(null) // Time when current segment animation started

  const [currentSpeed, setCurrentSpeed] = useState(0) // Speed in meters per second (m/s)
  const [elapsedTime, setElapsedTime] = useState(0) // Elapsed time in seconds
  const [currentTimestamp, setCurrentTimestamp] = useState<string | null>(null)
  const [traversedPath, setTraversedPath] = useState<[number, number][]>([]) // Path of actual dummy points reached
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null)

  // Effect to fetch dummy location data from the public directory
  useEffect(() => {
    async function fetchLocations() {
      try {
        const response = await fetch("/dummy-route.json")
        const data: LocationData[] = await response.json()
        setLocations(data)
        if (data.length > 0) {
          // Initialize with the first location
          setCurrentLocationIndex(0)
          setCurrentInterpolatedLocation(data[0]) // Set initial interpolated location
          setTraversedPath([[data[0].latitude, data[0].longitude]])
          setCurrentTimestamp(data[0].timestamp)
          setInitialCenter([data[0].latitude, data[0].longitude])
        }
      } catch (error) {
        console.error("Failed to fetch dummy route data:", error)
      }
    }
    fetchLocations()
  }, [])

  // Effect for the simulation logic (updating vehicle position, path, speed, and time)
  useEffect(() => {
    if (!isPlaying || locations.length === 0) {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current)
        animationFrameId.current = null
      }
      return
    }

    // Initialize segment start time when starting play or moving to a new segment
    if (segmentStartTimeRef.current === null) {
      segmentStartTimeRef.current = performance.now()
    }

    const animate = (currentTime: DOMHighResTimeStamp) => {
      // Stop animation if paused or reached end
      if (!isPlaying || currentLocationIndex >= locations.length) {
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current)
          animationFrameId.current = null
        }
        return
      }

      // Determine the previous and next actual points for interpolation
      const prevActualLoc = locations[currentLocationIndex > 0 ? currentLocationIndex - 1 : 0]
      const nextActualLoc = locations[currentLocationIndex]

      // Calculate the total duration for this segment based on timestamps
      const segmentDurationMs =
        new Date(nextActualLoc.timestamp).getTime() - new Date(prevActualLoc.timestamp).getTime()

      // Calculate time elapsed since the start of the current segment
      const timeSinceSegmentStart = currentTime - segmentStartTimeRef.current!

      // Calculate progress (0 to 1) within the current segment
      const progress = segmentDurationMs > 0 ? Math.min(timeSinceSegmentStart / segmentDurationMs, 1) : 1

      if (progress < 1) {
        // Interpolate position and timestamp
        const interpolatedLat = prevActualLoc.latitude + (nextActualLoc.latitude - prevActualLoc.latitude) * progress
        const interpolatedLon = prevActualLoc.longitude + (nextActualLoc.longitude - prevActualLoc.longitude) * progress

        // Interpolate timestamp
        const interpolatedTimeMs = new Date(prevActualLoc.timestamp).getTime() + segmentDurationMs * progress
        const interpolatedTimestamp = new Date(interpolatedTimeMs).toISOString()

        setCurrentInterpolatedLocation({
          latitude: interpolatedLat,
          longitude: interpolatedLon,
          timestamp: interpolatedTimestamp,
        })
        setCurrentTimestamp(interpolatedTimestamp)

        // Update total elapsed time from the very beginning of the route
        const totalElapsedTimeMs = interpolatedTimeMs - new Date(locations[0].timestamp).getTime()
        setElapsedTime(totalElapsedTimeMs / 1000)

        // Speed is calculated based on the average speed of the current segment
        const dist = haversineDistance(
          prevActualLoc.latitude,
          prevActualLoc.longitude,
          nextActualLoc.latitude,
          nextActualLoc.longitude,
        )
        setCurrentSpeed(segmentDurationMs > 0 ? dist / (segmentDurationMs / 1000) : 0)

        animationFrameId.current = requestAnimationFrame(animate)
      } else {
        // Vehicle has reached the next actual dummy point
        setCurrentInterpolatedLocation(nextActualLoc)
        setCurrentTimestamp(nextActualLoc.timestamp)

        // Add the reached point to the traversed path if it's not already the last one
        setTraversedPath((prevPath) => {
          const lastPoint = prevPath[prevPath.length - 1]
          if (!lastPoint || lastPoint[0] !== nextActualLoc.latitude || lastPoint[1] !== nextActualLoc.longitude) {
            return [...prevPath, [nextActualLoc.latitude, nextActualLoc.longitude]]
          }
          return prevPath
        })

        // Update total elapsed time to the timestamp of the reached point
        const totalElapsedTimeMs =
          new Date(nextActualLoc.timestamp).getTime() - new Date(locations[0].timestamp).getTime()
        setElapsedTime(totalElapsedTimeMs / 1000)

        // Calculate speed for the just completed segment
        const dist = haversineDistance(
          prevActualLoc.latitude,
          prevActualLoc.longitude,
          nextActualLoc.latitude,
          nextActualLoc.longitude,
        )
        setCurrentSpeed(segmentDurationMs > 0 ? dist / (segmentDurationMs / 1000) : 0)

        // Move to the next segment
        const nextIndex = currentLocationIndex + 1
        if (nextIndex < locations.length) {
          setCurrentLocationIndex(nextIndex)
          segmentStartTimeRef.current = performance.now() // Reset start time for the new segment
          animationFrameId.current = requestAnimationFrame(animate)
        } else {
          // End of route
          setIsPlaying(false)
          if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current)
            animationFrameId.current = null
          }
        }
      }
    }

    // Start the animation loop
    animationFrameId.current = requestAnimationFrame(animate)

    // Cleanup function to clear the animation frame when the component unmounts or dependencies change
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current)
        animationFrameId.current = null
      }
    }
  }, [isPlaying, currentLocationIndex, locations]) // Dependencies for the simulation effect

  // Callback to toggle play/pause state
  const togglePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev)
  }, [])

  // Callback to reset the simulation to the beginning
  const resetSimulation = useCallback(() => {
    setIsPlaying(false) // Pause simulation
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current) // Clear any active animation frame
      animationFrameId.current = null
    }
    segmentStartTimeRef.current = null // Reset segment start time

    setCurrentLocationIndex(0) // Reset index to the start
    if (locations.length > 0) {
      // Reset path, timestamp, and stats to the first location's data
      setCurrentInterpolatedLocation(locations[0])
      setTraversedPath([[locations[0].latitude, locations[0].longitude]])
      setCurrentTimestamp(locations[0].timestamp)
      setElapsedTime(0)
      setCurrentSpeed(0)
    } else {
      // Handle case where no locations are loaded yet
      setCurrentInterpolatedLocation(null)
      setTraversedPath([])
      setCurrentTimestamp(null)
      setElapsedTime(0)
      setCurrentSpeed(0)
    }
  }, [locations]) // Dependency on locations to ensure correct reset

  return (
    <div className="relative h-screen w-screen flex flex-col">
      {/* Render the map only when initialCenter is available */}
      <MapWrapper
        currentVehiclePosition={currentInterpolatedLocation}
        traversedPath={traversedPath}
        initialCenter={initialCenter}
      />

      {/* Overlay for controls and metadata */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-full max-w-md px-4">
        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Vehicle Simulation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {/* Display current coordinates */}
            <div className="flex items-center justify-between">
              <span className="font-medium">Current Coords:</span>
              <span>
                {currentInterpolatedLocation
                  ? `${currentInterpolatedLocation.latitude.toFixed(6)}, ${currentInterpolatedLocation.longitude.toFixed(6)}`
                  : "N/A"}
              </span>
            </div>
            {/* Display current timestamp */}
            <div className="flex items-center justify-between">
              <span className="font-medium">Timestamp:</span>
              <span>{currentTimestamp ? new Date(currentTimestamp).toLocaleTimeString() : "N/A"}</span>
            </div>
            {/* Display elapsed time */}
            <div className="flex items-center justify-between">
              <span className="font-medium">Elapsed Time:</span>
              <span>{elapsedTime.toFixed(1)} s</span>
            </div>
            {/* Display current speed */}
            <div className="flex items-center justify-between">
              <span className="font-medium">Speed:</span>
              <span>{currentSpeed.toFixed(2)} m/s</span>
            </div>
            {/* Play/Pause and Reset buttons */}
            <div className="flex justify-center gap-4 mt-4">
              <Button onClick={togglePlayPause} disabled={locations.length === 0}>
                {isPlaying ? <Pause className="h-5 w-5 mr-2" /> : <Play className="h-5 w-5 mr-2" />}
                {isPlaying ? "Pause" : "Play"}
              </Button>
              <Button onClick={resetSimulation} variant="outline" disabled={locations.length === 0}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
