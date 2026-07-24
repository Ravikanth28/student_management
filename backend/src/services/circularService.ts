import {
  findAllCirculars,
  createCircular,
  deleteCircular,
  type CircularRecord,
} from '../repositories/circularRepository.js';

export async function getCirculars(): Promise<CircularRecord[]> {
  return await findAllCirculars();
}

export async function broadcastCircular(
  title: string,
  content: string,
  target_audience: string,
  priority: string,
  created_by: string
): Promise<CircularRecord> {
  const id = await createCircular(title, content, target_audience, priority, created_by);
  return {
    id,
    title,
    content,
    target_audience,
    priority,
    created_by,
    created_at: new Date().toISOString(),
  };
}

export async function removeCircular(id: number): Promise<boolean> {
  return await deleteCircular(id);
}
