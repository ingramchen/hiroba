<script setup lang="ts">
import Popup from '../../gwt/Popup.vue';
import GwtImage from '../../gwt/GwtImage.vue';
import { GwtTable } from '../../gwt/panels';
import { IMG } from '../../assets/images';
import { t } from '../../runtime';
import type { MenuId } from '../../gwt/types';

const props = withDefaults(defineProps<{ menuId?: MenuId }>(), { menuId: 'login' });
const i18n = t();
</script>

<template>
  <Popup
    animated
    :caption="i18n.t('login')"
    :position="{ mode: 'relativeToMenuItem', menuId: props.menuId }"
  >
    <GwtTable
      :columns="1"
      :spacing="10"
      :table-style="{ height: '200px', width: '300px' }"
      :rows="[
        [{ textAlign: 'center', valign: 'middle' }],
        [{ textAlign: 'center', valign: 'middle', blank: true }],
        [{ textAlign: 'center', valign: 'middle' }],
        [{ textAlign: 'right', valign: 'middle' }],
      ]"
    >
      <GwtImage :img="IMG.largeLoading" cls="GlobalCssResource-img32" />
      <span class="gwt-CheckBox">
        <input type="checkbox" value="on" />
        <label>{{ i18n.t('rememberMe') }}</label>
      </span>
      <button type="button" class="gwt-Button">Cancel</button>
    </GwtTable>
  </Popup>
</template>
