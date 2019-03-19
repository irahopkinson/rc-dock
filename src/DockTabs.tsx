import React from "react";
import {DockContext, DockContextType, DropDirection, PanelData, TabData, TabGroup} from "./DockData";
import {compareChildKeys, compareKeys} from "./util/Compare";
import Tabs, {TabPane} from 'rc-tabs';
import TabContent from 'rc-tabs/lib/TabContent';
import ScrollableInkTabBar from 'rc-tabs/lib/ScrollableInkTabBar';
import {DragStore} from "./DragStore";
import {DragInitFunction, DragInitHandler, DragInitiator} from "./DragInitiator";
import {DockTabBar} from "./DockTabBar";

export class TabCache {

  static readonly usedDataKeys = ['id', 'title', 'group', 'content'];

  _ref: HTMLDivElement;
  getRef = (r: HTMLDivElement) => {
    this._ref = r;
  };

  data: TabData;
  context: DockContext;
  content: React.ReactNode;

  constructor(context: DockContext) {
    this.context = context;
  }

  setData(data: TabData) {
    if (!compareKeys(data, this.data, TabCache.usedDataKeys)) {
      this.data = data;
      this.content = this.render();
      return true;
    }
    return false;
  }

  onCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();

  };
  onDragStart = (e: React.DragEvent) => {
    DragStore.dragStart(DockContextType, {tab: this.data}, this._ref);
  };
  onDragOver = (e: React.DragEvent) => {
    let tab: TabData = DragStore.getData(DockContextType, 'tab');
    if (tab && tab !== this.data && tab.group === this.data.group) {
      let rect = this._ref.getBoundingClientRect();
      let midx = rect.left + rect.width * 0.5;
      let direction: DropDirection = e.clientX > midx ? 'after-tab' : 'before-tab';
      this.context.setDropRect(this._ref, direction);
      e.dataTransfer.dropEffect = 'link';
      e.preventDefault();
      e.stopPropagation();
    }
  };
  onDrop = (e: React.DragEvent) => {

  };

  render(): React.ReactNode {
    let {id, title, group, content} = this.data;
    let {closable, tabLocked} = group;
    if (typeof content === 'function') {
      content = content();
    }
    return (
      <TabPane key={id} tab={
        <div ref={this.getRef} draggable={!tabLocked} onDrag={this.onDragStart} onDragOver={this.onDragOver}
              onDrop={this.onDrop}>
          {title}
          {closable ?
            <a className='dock-tabs-tab-close-btn' onClick={this.onCloseClick}>x</a>
            : null}

        </div>
      }>
        {content}
      </TabPane>
    );
  }

  destroy() {

  }
}

interface Props {
  panelData: PanelData;
  onPanelHeaderDrag: DragInitHandler;
}

interface State {

}

export class DockTabs extends React.Component<Props, any> {
  static contextType = DockContextType;

  static readonly propKeys = ['group', 'activeId', 'onTabChange'];

  context!: DockContext;
  _cache: Map<string, TabCache> = new Map();

  constructor(props: Props, context: any) {
    super(props, context);
    this.updateTabs(props.panelData.tabs);
  }

  updateTabs(tabs: TabData[]) {
    let newCache = new Map<string, TabCache>();
    let reused = 0;
    for (let tabData of tabs) {
      let {id} = tabData;
      if (this._cache.has(id)) {
        let tab = this._cache.get(id);
        newCache.set(id, tab);
        tab.setData(tabData);
        ++reused;
      } else {
        let tab = new TabCache(this.context);
        newCache.set(id, tab);
        tab.setData(tabData);
      }
    }
    if (reused !== this._cache.size) {
      for (let [id, tab] of this._cache) {
        if (!newCache.has(id)) {
          tab.destroy();
        }
      }
    }
    this._cache = newCache;
  }

  shouldComponentUpdate(nextProps: Readonly<Props>, nextState: Readonly<any>, nextContext: any): boolean {
    let {tabs} = nextProps.panelData;

    // update tab cache
    if (!compareChildKeys(tabs, this.props.panelData.tabs, TabCache.usedDataKeys)) {
      this.updateTabs(tabs);
      return true;
    }
    return !compareKeys(this.props, nextProps, DockTabs.propKeys);
  }

  renderTabBar = () => (
    <DockTabBar onDragInit={this.props.onPanelHeaderDrag}/>
  );
  renderTabContent = () => <TabContent/>;

  onTabChange = (activeId: string) => {
    this.props.panelData.activeId = activeId;
    this.forceUpdate();
  };

  render(): React.ReactNode {
    let {group, activeId} = this.props.panelData;
    let {closable, tabLocked} = group;

    let children: React.ReactNode[] = [];
    for (let [id, tab] of this._cache) {
      children.push(tab.content);
    }

    return (
      <Tabs prefixCls='dock-tabs'
            renderTabBar={this.renderTabBar}
            renderTabContent={this.renderTabContent}
            activeKey={activeId}
            onChange={this.onTabChange}
      >
        {children}
      </Tabs>
    );
  }
}