# Brief: look at the pictures

You look at what was cut from the book for one lesson and say what is wrong. You change nothing.

Read every file in `tools/lessons/work/<id>/package/images/`, and `regions/spot-*.jpg` beside `package/` if there
are any (each `spot` question's regions drawn on its picture: green is the right one). The source is
`lesson.src.json`; the pages are `page-N.png` (150 dpi; a picture's `box` is `[x, y, w, h]` in their pixels).

For each picture:

- It holds **the whole picture and nothing else**: no edge cut off, no half line of caption, no strip of the next
  column or of another picture.
- Several boxes set side by side are in the order the text calls them («αριστερή», «δεξιά»).
- What a question asks about it can be seen in it as cut: the labels can be read, the thing is there.
- A `spot`: each region covers its place, the green one is the place the question asks for, none overlap, and a
  child's finger can hit it.

For one that is wrong, open its page and give the box that would be right, in pixels. Say only what you saw: a
picture you did not open is not "fine".
