// RichTextEditor.js
import { Editor, EditorTools } from "@progress/kendo-react-editor";
import "./RichTextEditor.css";

const {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Indent,
  Outdent,
  OrderedList,
  UnorderedList,
  Undo,
  Redo,
  FontSize,
  FontName,
  FormatBlock,
  Link,
  Unlink,
} = EditorTools;

const EDITOR_TOOLS = [
  [Bold, Italic, Underline, Strikethrough],
  [Subscript, Superscript],
  [AlignLeft, AlignCenter, AlignRight, AlignJustify],
  [Indent, Outdent],
  [OrderedList, UnorderedList],
  FontSize,
  FontName,
  FormatBlock,
  [Undo, Redo],
  [Link, Unlink],
];

const RichTextEditor = ({ value, onChange }) => {
  return <Editor tools={EDITOR_TOOLS} value={value} onChange={onChange} />;
};

export default RichTextEditor;
