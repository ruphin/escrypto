export const log = string => {
  document.body.appendChild(document.createTextNode(string));
  document.body.appendChild(document.createElement('br'));
};
