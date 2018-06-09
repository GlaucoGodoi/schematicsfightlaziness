import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';
import { PathFragment } from '@angular-devkit/core';

export interface PathShortCutsParameters {
  // If true will display the new content in the console
  showNewContent: boolean;

  // If true a backup named tsconfig.json.Backup will be created.
  createBackup: boolean;
}

export interface TsconfigFragment {
  compilerOptions: {
    paths: any
  }
}

export class BasicPathConfiguration {
  public paths = new Array<{ shortcut: string, relativePath: string }>();
  public itemsForSearchReplace: Array<{ shortcut: string, relativePath: string }>;

  constructor() {
    // Here you can add the folders and shortcuts that make sense to your environment
    this.paths.push({ shortcut: '@configs/*', relativePath: 'src/app/configs/*' });
    this.paths.push({ shortcut: '@sharedServices*', relativePath: 'src/app/shared/services*' });
    this.paths.push({ shortcut: '@environments/*', relativePath: 'src/environments/*' });
    this.paths.push({ shortcut: '@sharedComponents/*', relativePath: 'src/app/shared/compo*' });

    this.fillItemsForSearchReplace();
  }

  // This function will remove the noise from the configuration
  private fillItemsForSearchReplace(): void {
    this.itemsForSearchReplace = this.paths.map(item => {
      return {
        shortcut: item.shortcut.replace('*', ''),
        relativePath: item.relativePath.replace('*', '')
      };
    });
  }
}

// This is the factory (Rule) that will add the configuration to tsconfig.json 
export function AddFolderShortcuts(options: PathShortCutsParameters): Rule {
  return (tree: Tree, _context: SchematicContext) => {

    //Search for tsconfig.json
    const tsConfigFile = tree.root.subfiles.find((value: PathFragment) => {
      return value === 'tsconfig.json'
    });

    if (tsConfigFile) {
      _context.logger.info(`tsconfig.json found!`);
    } else {
      // do nothing
      _context.logger.warn(`tsconfig.json was not found!`);
      return tree;
    }

    //Read the file content
    const tsConfigContent = tree.read(tree.root.path + '/' + tsConfigFile);
    const tsConfigData: TsconfigFragment =
      JSON.parse(tsConfigContent ? tsConfigContent.toString() : 'void');

    //Check if the data already contain some path configuration
    if (tsConfigData.compilerOptions.hasOwnProperty('paths')) {
      _context.logger.info('The file already have the following paths configured:');
      _context.logger.info(JSON.stringify(tsConfigData.compilerOptions.paths, null, ' '));
      return tree;
    }

    //Create a backupfile
    if (options.createBackup) {
      tree.create(`${tsConfigFile}.Backup`, JSON.stringify(tsConfigData, null, ' '));
    }

    //Add the new content to tsconfig.json
    var pathsToAdd = new BasicPathConfiguration();

    tsConfigData.compilerOptions.paths = {};
    pathsToAdd.paths.forEach(path => {
      _context.logger.info(`Adding the shortcut ${path.shortcut} pointing to ${path.relativePath}`);
      tsConfigData.compilerOptions.paths[path.shortcut] = [path.relativePath];
    });

    // If requested, show the new content
    if (options.showNewContent) {
      _context.logger.info('');
      _context.logger.info('The new file content will be:');
      console.info(JSON.stringify(tsConfigData, null, ' '));
    }

    // Write the changes to the tree. Later the schematics infrastructure will handle the file update.
    tree.overwrite(tsConfigFile, JSON.stringify(tsConfigData, null, ' '));

    return tree;
  };
}

//////////////////////////////////// update imports /////////////////////////////

export interface UpdateImportsParameters {
  // This will be the initial folder to start the searching.
  targetFolder: string
}

// This is the factory (Rule) that will update the .ts files 
export function UpdateImportStatements(options: UpdateImportsParameters): Rule {
  return (tree: Tree, _context: SchematicContext) => {

    // Setup the initial folder to process
    options.targetFolder =
      options.targetFolder || tree.root.subdirs[tree.root.subdirs.length - 1];
    
      _context.logger
      .info(`The process will scan files starting at the folder ${options.targetFolder}.`);

    const shortcutConfig = new BasicPathConfiguration();

    tree.getDir(options.targetFolder).visit(path => {
      if (path.endsWith('.ts')) {
        
        const fileContent: Buffer | null = tree.read(path);
        
        if (fileContent) {
          let textContent = fileContent.toString();

          shortcutConfig.itemsForSearchReplace.forEach(item => {
            if (textContent.indexOf(item.relativePath) > -1) {
              textContent = textContent.replace(item.relativePath, item.shortcut);
              tree.overwrite(path,textContent);
            }
          });
        }
      }
    });
    return tree;
  };
}
