-- Match saved/created pagination without changing stable ordering or ACL filters.
CREATE INDEX diary_author_saved ON diaries(author_id,updated_at DESC,id DESC) WHERE deleted_at IS NULL;
CREATE INDEX diary_class_saved ON diaries(class_id,updated_at DESC,id DESC) WHERE deleted_at IS NULL;
CREATE INDEX diary_author_created ON diaries(author_id,created_at DESC,id DESC) WHERE deleted_at IS NULL;
CREATE INDEX account_class_role ON accounts(class_id,role,active,display_name);
CREATE INDEX diary_comments_diary ON diary_comments(diary_id,created_at,id) WHERE deleted_at IS NULL;
CREATE INDEX board_comments_post ON board_comments(post_id,created_at,id) WHERE deleted_at IS NULL;
