import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';

const PAGE_SIZE = 200;

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const adminRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'admin_access_backfill',
      2,
    );
    if (!adminRate.allowed) {
      return Response.json({ error: 'Admin operation rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const entities = base44.asServiceRole.entities;
    let updatedTracks = 0;
    let updatedVersions = 0;
    let updatedFiles = 0;
    let updatedFolders = 0;
    let updatedMilestones = 0;
    let updatedProjects = 0;

    for (let skip = 0; ; skip += PAGE_SIZE) {
      const projects = await entities.Project.filter({}, '-created_date', PAGE_SIZE, skip);
      for (const project of projects) {
      const expectedEditors = Array.from(new Set(
        Object.entries(project.collaborator_roles || {})
          .filter(([, role]) => role === 'editor')
          .map(([id]) => id)
      ));
      const currentEditors = Array.isArray(project.editor_ids) ? project.editor_ids : [];
      if (JSON.stringify([...currentEditors].sort()) !== JSON.stringify([...expectedEditors].sort())) {
        await entities.Project.update(project.id, { editor_ids: expectedEditors });
        updatedProjects += 1;
      }
      }
      if (projects.length < PAGE_SIZE) break;
    }

    for (let skip = 0; ; skip += PAGE_SIZE) {
      const tracks = await entities.Track.filter({}, '-created_date', PAGE_SIZE, skip);

      for (const track of tracks) {
      if (Array.isArray(track.access_user_ids) && track.access_user_ids.length > 0) continue;

      let accessUserIds = [track.uploaded_by].filter(Boolean);
      try {
        const project = await entities.Project.get(track.project_id);
        if (project) {
          accessUserIds = Array.from(new Set([
            project.owner_id,
            ...(project.collaborator_ids || []),
            track.uploaded_by,
          ].filter(Boolean)));
          const editorIds = Array.from(new Set([
            project.owner_id,
            ...(project.editor_ids || Object.entries(project.collaborator_roles || {})
              .filter(([, role]) => role === 'editor')
              .map(([id]) => id)),
            track.uploaded_by,
          ].filter(Boolean)));
          track.__backfill_edit_user_ids = editorIds;
        }
      } catch {
        // Chat-session tracks and legacy orphaned tracks fall back to uploader-only.
      }

      await entities.Track.update(track.id, {
        access_user_ids: accessUserIds,
        edit_user_ids: track.__backfill_edit_user_ids || [track.uploaded_by].filter(Boolean),
      });
      updatedTracks += 1;

      for (let versionSkip = 0; ; versionSkip += PAGE_SIZE) {
        const versions = await entities.TrackVersion.filter(
          { track_id: track.id },
          '-created_date',
          PAGE_SIZE,
          versionSkip,
        );
        for (const version of versions) {
          if (Array.isArray(version.access_user_ids) && version.access_user_ids.length > 0) continue;
          await entities.TrackVersion.update(version.id, {
            access_user_ids: accessUserIds,
            edit_user_ids: track.__backfill_edit_user_ids || [version.saved_by_id].filter(Boolean),
          });
          updatedVersions += 1;
        }
        if (versions.length < PAGE_SIZE) break;
      }
      }
      if (tracks.length < PAGE_SIZE) break;
    }

    for (let skip = 0; ; skip += PAGE_SIZE) {
      const sharedFiles = await entities.SharedFile.filter({}, '-created_date', PAGE_SIZE, skip);
      for (const file of sharedFiles) {
      if (Array.isArray(file.access_user_ids) && file.access_user_ids.length > 0) continue;

      let accessUserIds = [file.uploader_id].filter(Boolean);
      if (file.project_id) {
        try {
          const project = await entities.Project.get(file.project_id);
          if (project) {
            accessUserIds = Array.from(new Set([
              project.owner_id,
              ...(project.collaborator_ids || []),
              file.uploader_id,
            ].filter(Boolean)));
          }
        } catch {
          // Preserve uploader-only access if the legacy project no longer exists.
        }
      }

      await entities.SharedFile.update(file.id, {
        access_user_ids: accessUserIds,
        share_token_hash: null,
        share_token_expires_at: null,
      });
      updatedFiles += 1;
      }
      if (sharedFiles.length < PAGE_SIZE) break;
    }

    for (let skip = 0; ; skip += PAGE_SIZE) {
      const folders = await entities.Folder.filter({}, '-created_date', PAGE_SIZE, skip);
      for (const folder of folders) {
      if (Array.isArray(folder.access_user_ids) && folder.access_user_ids.length > 0) continue;
      let accessUserIds = [folder.owner_id].filter(Boolean);
      if (folder.project_id) {
        try {
          const project = await entities.Project.get(folder.project_id);
          if (project) {
            accessUserIds = Array.from(new Set([
              project.owner_id,
              ...(project.collaborator_ids || []),
              folder.owner_id,
            ].filter(Boolean)));
            folder.__backfill_edit_user_ids = Array.from(new Set([
              project.owner_id,
              ...(project.editor_ids || Object.entries(project.collaborator_roles || {})
                .filter(([, role]) => role === 'editor')
                .map(([id]) => id)),
              folder.owner_id,
            ].filter(Boolean)));
          }
        } catch {}
      }
      await entities.Folder.update(folder.id, {
        access_user_ids: accessUserIds,
        edit_user_ids: folder.__backfill_edit_user_ids || [folder.owner_id].filter(Boolean),
      });
      updatedFolders += 1;
      }
      if (folders.length < PAGE_SIZE) break;
    }

    for (let skip = 0; ; skip += PAGE_SIZE) {
      const milestones = await entities.Milestone.filter({}, '-created_date', PAGE_SIZE, skip);
      for (const milestone of milestones) {
      if (Array.isArray(milestone.access_user_ids) && milestone.access_user_ids.length > 0) continue;
      let accessUserIds = [milestone.created_by_id].filter(Boolean);
      try {
        const project = await entities.Project.get(milestone.project_id);
        if (project) {
          accessUserIds = Array.from(new Set([
            project.owner_id,
            ...(project.collaborator_ids || []),
            milestone.created_by_id,
          ].filter(Boolean)));
          milestone.__backfill_edit_user_ids = Array.from(new Set([
            project.owner_id,
            ...(project.editor_ids || Object.entries(project.collaborator_roles || {})
              .filter(([, role]) => role === 'editor')
              .map(([id]) => id)),
            milestone.created_by_id,
          ].filter(Boolean)));
        }
      } catch {}
      await entities.Milestone.update(milestone.id, {
        access_user_ids: accessUserIds,
        edit_user_ids: milestone.__backfill_edit_user_ids || [milestone.created_by_id].filter(Boolean),
      });
      updatedMilestones += 1;
      }
      if (milestones.length < PAGE_SIZE) break;
    }

    return Response.json({
      success: true,
      updatedTracks,
      updatedVersions,
      updatedFiles,
      updatedFolders,
      updatedMilestones,
      updatedProjects,
    });
  } catch (error) {
    console.error('backfillTrackAccess failed:', error);
    return Response.json({ error: error?.message || 'Backfill failed' }, { status: 500 });
  }
});
