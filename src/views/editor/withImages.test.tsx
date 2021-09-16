
describe('pasting text with images', function() {
  test('image, text, image');
  test('text, image, text');
})

/*
 Example I was using while developing and discovering the tricky features here:
 
 Some text here
![Image description](/Users/me/notes/design/2020/04/attachments/Screen%20Shot%202020-04-20%20at%2010.43.18%20AM.png)
Ready to be gobbled up? 



Flip the above around so its image, text, image, for same effect.
 */

describe('links', function() {
  it('replaces link when linking inside an existing link')
  it('converts markdown text to link on paste')

  describe('viewing link', function() {
    it('displays a pop-up view menu when a link (and only a link) is focused or highlighted')
    it('clicking remove unlinks the link')
  })

  describe('existing link', function() {
    it('opens view menu when an existing link is clicked')
    it('lets you modify an existing link when clicking edit, saving updates the link')
    it('clicking cancel after edit deselects the link')
    it('todo: emptying the url box and hitting save unwraps the link')
  })

  describe('creating a new link', function() {
    it('lets you paste a url over highlighted text to create a link')
    it('opens the edit menu for selected text')
  })
})