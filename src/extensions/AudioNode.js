/**
 * AudioNode — Custom Tiptap Node for inline audio players.
 *
 * Usage in editor:
 *   editor.chain().focus().setAudioBlock({ src: 'https://...mp3', title: 'My Audio' }).run()
 *
 * Stored in JSON:
 *   { "type": "audioBlock", "attrs": { "src": "https://...", "title": "..." } }
 *
 * Rendered as:
 *   <div data-audio-block class="kb-audio-player">
 *     <audio controls src="..."></audio>
 *     <span>title</span>
 *   </div>
 */
import { Node, mergeAttributes } from '@tiptap/core';

export const AudioNode = Node.create({
  name: 'audioBlock',
  group: 'block',
  atom: true, // non-editable, treated as a single unit

  addAttributes() {
    return {
      src: { default: null },
      title: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-audio-block]',
        getAttrs: (dom) => ({
          src: dom.querySelector('audio')?.getAttribute('src') || null,
          title: dom.querySelector('.kb-audio-player__label')?.textContent || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, title } = HTMLAttributes;
    return [
      'div',
      mergeAttributes({ 'data-audio-block': '', class: 'kb-audio-player' }),
      ['audio', { controls: '', src, preload: 'metadata' }],
      ['span', { class: 'kb-audio-player__label' }, title || src || 'Audio'],
    ];
  },

  addCommands() {
    return {
      setAudioBlock: (attrs) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs,
        });
      },
    };
  },
});
