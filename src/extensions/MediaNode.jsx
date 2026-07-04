/**
 * MediaNode — Custom Tiptap Node for inline media players (YouTube, Drive, Audio, Video).
 */
import React from 'react';
import { Node, mergeAttributes, nodePasteRule } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import MediaPreview from '../components/MediaPreview';
import { 
  extractDriveDirectUrl, 
  extractDriveFileId, 
  getMediaType, 
  getYoutubeEmbedUrl 
} from '../utils/mediaUtils';

// Regex for Google Drive links, YouTube links, and standard direct audio/video links
const DRIVE_REGEX = /(https?:\/\/drive\.google\.com\/(?:file\/d\/[a-zA-Z0-9_-]+|open\?id=[a-zA-Z0-9_-]+)[^\s]*)/g;
const YOUTUBE_REGEX = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&? ]{11}))/ig;
const AUDIO_REGEX = /(https?:\/\/[^\s]+\.(?:mp3|m4a|ogg|wav|aac|flac|webm)(?:\?[^\s]*)?)/ig;
const VIDEO_REGEX = /(https?:\/\/[^\s]+\.(?:mp4|webm|ogg|ogv|mov|mkv)(?:\?[^\s]*)?)/ig;

/**
 * React Component for the NodeView wrapper.
 */
function MediaNodeView({ node, updateAttributes }) {
  const { src, title } = node.attrs;

  const handleToggleFormat = (newUrl) => {
    updateAttributes({ src: newUrl });
  };

  return (
    <NodeViewWrapper className="kb-tiptap-media-wrapper" style={{ margin: '1.25rem 0', display: 'block' }}>
      <MediaPreview 
        url={src} 
        title={title} 
        onToggleFormat={handleToggleFormat} 
      />
    </NodeViewWrapper>
  );
}

export const MediaNode = Node.create({
  name: 'mediaBlock',
  group: 'block',
  atom: true, // Treated as a single unit, non-editable text-wise

  addAttributes() {
    return {
      src: { default: null },
      title: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-media-block]',
        getAttrs: (dom) => ({
          src: dom.querySelector('iframe')?.getAttribute('src') || 
               dom.querySelector('audio')?.getAttribute('src') || 
               dom.querySelector('video')?.getAttribute('src') || 
               null,
          title: dom.querySelector('.kb-audio-player__label')?.textContent || '',
        }),
      },
      // Backward compatibility with legacy audioBlock tag name
      {
        tag: 'div[data-audio-block]',
        getAttrs: (dom) => ({
          src: dom.querySelector('iframe')?.getAttribute('src') || 
               dom.querySelector('audio')?.getAttribute('src') || 
               null,
          title: dom.querySelector('.kb-audio-player__label')?.textContent || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, title } = HTMLAttributes;
    const mediaType = getMediaType(src);

    switch (mediaType) {
      case 'youtube': {
        const embedUrl = getYoutubeEmbedUrl(src);
        return [
          'div',
          mergeAttributes({ 'data-media-block': '', class: 'kb-video-embed' }),
          ['iframe', { src: embedUrl, title: title || 'YouTube Video', allowfullscreen: '' }],
        ];
      }

      case 'drive': {
        const fileId = extractDriveFileId(src);
        const isVideo = src?.includes('#video');
        const height = isVideo ? '360' : '80';
        return [
          'div',
          mergeAttributes({ 'data-media-block': '', class: 'kb-audio-player', style: 'background: none; padding: 0;' }),
          ['iframe', {
            src: `https://drive.google.com/file/d/${fileId}/preview`,
            style: `width: 100%; height: ${height}px; border: none; border-radius: 8px; overflow: hidden;`,
            allow: 'autoplay',
            allowfullscreen: ''
          }],
          ['span', { class: 'kb-audio-player__label', style: 'margin-top: 0.5rem; display: block;' }, title || 'Google Drive Media'],
        ];
      }

      case 'audio': {
        return [
          'div',
          mergeAttributes({ 'data-media-block': '', class: 'kb-audio-player' }),
          ['audio', { controls: '', src: src?.split('#')[0], style: 'width: 100%;' }],
          ['span', { class: 'kb-audio-player__label' }, title || src || 'Audio'],
        ];
      }

      case 'video': {
        return [
          'div',
          mergeAttributes({ 'data-media-block': '', class: 'kb-audio-player', style: 'background: none; padding: 0; border: none;' }),
          ['video', { controls: '', src: src?.split('#')[0], style: 'width: 100%; max-height: 400px; border-radius: 8px; background: #000;' }],
          ['span', { class: 'kb-audio-player__label', style: 'margin-top: 0.5rem; display: block;' }, title || 'Video'],
        ];
      }

      default:
        // Safe fallback link
        return [
          'a',
          mergeAttributes({ href: src, target: '_blank', rel: 'noopener noreferrer' }),
          title || src || 'Link'
        ];
    }
  },

  addCommands() {
    return {
      setMediaBlock: (attrs) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs,
        });
      },
      // Backward compatibility command mapping
      setAudioBlock: (attrs) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs,
        });
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(MediaNodeView);
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: DRIVE_REGEX,
        type: this.type,
        getAttributes: match => {
          const url = match[1];
          const directUrl = extractDriveDirectUrl(url);
          if (!directUrl) return null;
          return { src: directUrl, title: 'Google Drive Media' };
        },
      }),
      nodePasteRule({
        find: YOUTUBE_REGEX,
        type: this.type,
        getAttributes: match => {
          const url = match[1];
          return { src: url, title: 'YouTube Video' };
        },
      }),
      nodePasteRule({
        find: AUDIO_REGEX,
        type: this.type,
        getAttributes: match => {
          const url = match[1];
          return { src: url + '#audio', title: url.split('/').pop() || 'Audio' };
        },
      }),
      nodePasteRule({
        find: VIDEO_REGEX,
        type: this.type,
        getAttributes: match => {
          const url = match[1];
          return { src: url + '#video', title: url.split('/').pop() || 'Video' };
        },
      }),
    ];
  },
});
