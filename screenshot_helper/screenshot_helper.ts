import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as looksSame from 'looks-same';

import { browser, ElementFinder, WebElement } from 'protractor';

let mask_fn = require('./mask').MASK_FN;

/**
 * Compare a screenshot to a reference, or "golden" image.
 * Returns a Promise that resolves to whether or not the
 * screenshot is a match. If the UPDATE_SCREENSHOTS environment
 * variable is set, the promise resolves to true and the
 * golden image is updated.
 *

 * @param data - The screenshot image data.
 * @param golden - The path to the golden image to compare to.
 * @param outputFolder - The destination path for saving the diff. if it is not provided, the difference image will not be

 *   saved.
 */
export async function compareScreenshot(data, golden, outputFolder = undefined, looksSameOptions: looksSame.LooksSameOptions = {}): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
    const tempFolder = createTempFolder();
    const screenshotPath = await writeScreenshot(tempFolder, data);
    // check if goldens need to be updated
    const update = process.env['UPDATE_GOLDENS'] === '1' || process.env['UPDATE_GOLDENS'] === 'true';
    if (update && !fs.existsSync(golden)) {
      fs.writeFileSync(golden, fs.readFileSync(screenshotPath));
      resolve('Reference image ' + golden + ' was successfully updated.');
      return;
    }
    const goldenName = path.basename(golden);
    looksSame(screenshotPath, golden, {
      ...{
        strict: false,
          tolerance: 2.5,
      },
      ...looksSameOptions,
    }, async (error, equal) => {
      if (error) {
        reject("There has been an error. Error: " + error);
        return;
      }
      if (!equal) {
        if (update) {
          fs.writeFileSync(golden, fs.readFileSync(screenshotPath));
          resolve('Reference image ' + golden + ' was successfully updated.');
        } else if (outputFolder) {
          const diffPath = path.join(outputFolder, `diff-${goldenName}`);
          looksSame.createDiff({
            reference: golden,
            current: screenshotPath,
            diff: diffPath,
            highlightColor: '#ff00ff',  // color to highlight the differences
          }, (err) => {
            if (err) {
              reject('An error occurred while saving the diff image: ' + err);
              return;
            }
            const currentPath = path.join(outputFolder, `current-${goldenName}`);
            fs.writeFileSync(currentPath, fs.readFileSync(screenshotPath));
            reject(`Screenshot ${currentPath} do not match for ${golden}. Difference picture is saved as ${diffPath}.`);
          });
        } else { reject(`Screenshots do not match for ${golden}.`); }
      } else {
        resolve('The test passed. ');
      }
    });
  });
}

function createTempFolder() {
  return fs.mkdtempSync(`${os.tmpdir()}${path.sep}`);
}
/**
 *  Write a screenshot to disk in a new temporary path.
 */
async function writeScreenshot(folder, data) {
  let screenshotFile = path.join(folder, 'new.png');
  fs.writeFileSync(screenshotFile, data, 'base64');
  return screenshotFile;
}

export async function addMask(el: ElementFinder, color, zIndex = 10000, xOffset = 0, yOffset = 0, sizeMultiplier = 1.0) {
  let rect = await el.getRect();
  const mask: WebElement = <WebElement> await browser.executeScript(
      mask_fn,
      rect.x + xOffset,
      rect.y + yOffset,
      rect.width * sizeMultiplier,
      rect.height * sizeMultiplier,
      color,
      zIndex
  );
  return mask;
}

export async function removeMask(mask: WebElement) {
  await browser.executeScript("arguments[0].parentNode.removeChild(arguments[0])", mask);
}
