import { useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { rememberWorldContext, WORLD_CONTEXTS } from '@/lib/nalibaseWorldContext';

export default function WorldHub() {
  const { worldId } = useParams();
  const { search, hash, state } = useLocation();
  const { user } = useAuth();
  const world = Object.hasOwn(WORLD_CONTEXTS, worldId) ? WORLD_CONTEXTS[worldId] : null;

  useEffect(() => {
    if (world && user?.id) rememberWorldContext(worldId, user.id);
  }, [world, worldId, user?.id]);

  if (!world) return <Navigate to="/" replace />;
  return <Navigate to={{ pathname: world.storefronts[0].path, search, hash }} state={{ ...state, fromWorld: worldId }} replace />;
}
