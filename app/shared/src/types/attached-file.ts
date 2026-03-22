export type AttachedFileEntityType = 'student' | 'lesson' | 'homework' | 'subject' | 'project' | 'task';
export type AttachedFileCategory = 'homework' | 'lesson_plan' | 'material' | 'notes' | 'test' | 'solution';
export type AttachedFileType = 'docx' | 'pdf' | 'md' | 'py' | 'txt' | 'xlsx' | 'pptx';

export type AttachedFileStatus = 'pending' | 'completed';

export interface AttachedFile {
  id: string;
  entityType: AttachedFileEntityType;
  entityId: string | null;
  filename: string;
  filepath: string;
  fileType: AttachedFileType;
  category: AttachedFileCategory;
  status: AttachedFileStatus;
  topicId: string | null;
  createdAt: Date;
}
