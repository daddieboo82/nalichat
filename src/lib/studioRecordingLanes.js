import { getStudioClipLaneId } from './studioClipLanes.js';

// Record-arm is a lane-level action even though split segments have separate IDs.
// The root clip stores the arm flag; sibling source clips should not be heard
// as overdub backing while recording on the same lane.
export function isStudioArmedLane(track, tracks) {
  if (!track || !Array.isArray(tracks)) return false;
  const laneId = getStudioClipLaneId(track);
  return tracks.some(candidate => candidate?.armed &&
    getStudioClipLaneId(candidate) === laneId);
}
