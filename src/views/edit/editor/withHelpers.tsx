import { Text, Transforms, Node as SlateNode, Range, Path as SlatePath, createEditor, Descendant, Editor, Element as SlateElement } from 'slate'
import { ReactEditor } from 'slate-react';
import { toaster} from 'evergreen-ui';
import { isTypedElement, isLinkElement } from '../util';
import { insertLink, urlMatcher } from './blocks/links';
import { insertFile, isImageUrl } from './blocks/images';
import { stringToSlate } from '../../../markdown';

// todo: dont use this here!
import client from '../../../client';


/**
 * Image and link helpers. Maybe more.
 * 
 * Will look at refactoring once I finish the first phase of wysiwyg work and understand it better.
 * @param editor 
 * @returns 
 */
export const withHelpers = (editor: ReactEditor) => {
  const { isVoid, normalizeNode, isInline } = editor
 
  // If the element is an image type, make it non-editable
  // https://docs.slatejs.org/concepts/02-nodes#voids
  editor.isVoid = element => {
    // type is a custom property
    return (element as any).type === 'image' || (element as any).type === 'video' ? true : isVoid(element)
  }

  // If links are not treated as inline, they'll be picked up by the unwrapping
  // normalization step and turned into regular text
  // todo: move to withLinks helper?
  editor.isInline = element => {
    return isLinkElement(element) ? true : isInline(element)
  }

  // I was working on: type in markdown image text, hit enter, it shoudl convert to image
  // but then thought... I always either paste in image urls OR drag and drop
  // Then again...if I was going to paste an image, I could also paste it inside of a real markdown
  // image tag... or infer it from an image url being pasted... but that could be annoying... 
  // ...I can see why Notion prompts you with a dropdown
  // editor.insertBreak = () => {
  //   if (editor.selection?.focus.path) {
  //     // If the parent contains an image, but is _not_ an image node, turn it into one... 
  //     const parentPath = SlatePath.parent(editor.selection.focus.path);
  //     const parentNode = SlateNode.get(editor, parentPath);
  //   }

  //   insertBreak()
  // }


  // pasted data
  editor.insertData = (data: DataTransfer) => {
    const text = data.getData('text/plain');
    const { files } = data

    // Implement it for real, once image uploading is decided upon
    if (files && files.length > 0) {
      for (const file of files) {
        if (!isImageUrl(file.path)) {
          toaster.warning('Only images with known image extensions may be added to notes')
          return;
        }
        
        // this works, but the preview in network tab does not. weird.
        // todo: error as a popup, progress and intermediate state
        // todo: handle editor being unmounted, more generally move this 
        // to a higher level abstraction. For now it doesn't really matter.
        client.v2.files.upload(file).then((json) => {
          insertFile(editor, json.filename)
        }, console.error);
      }
    } else if (text && text.match(urlMatcher)) {
      // and isText? 
      insertLink(editor, text, editor.selection)
    } else {
      // NOTE: Calling this for all pasted data is quite experimental
      // and will need to change.
      convertAndInsert(editor, text)
    }
  }

  // Originally added to fix the case where an a mix of markdown image and text is copied,
  // but because of markdown rules that require multiple newlines between paragraphs, 
  // slate was gobbling up images or text depending on the order
  // todo: add test cases
  // https://docs.slatejs.org/concepts/11-normalizing
  editor.normalizeNode = entry => {
    const [node, path] = entry;

    if (isTypedElement(node) && node.type === 'paragraph') {
      for (const [child, childPath] of SlateNode.children(editor, path)) {
        if (SlateElement.isElement(child) && !editor.isInline(child)) {
          Transforms.unwrapNodes(editor, { at: childPath })
          return
        }
      }
    }
    
    // Fall back to the original `normalizeNode` to enforce other constraints.
    normalizeNode(entry)
  }

  return editor
}

/**
 * Convert text to mdast -> SlateJSON, then insert into the document
 */
function convertAndInsert(editor: ReactEditor, text: string) {
  Transforms.insertNodes(editor, stringToSlate(text));
}
