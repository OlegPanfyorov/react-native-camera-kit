import PropTypes from 'prop-types';
import React, { Component } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  NativeModules,
  Platform,
  ImageBackground
} from 'react-native';
import _ from 'lodash';
import CameraKitCamera from './../CameraKitCamera';

const IsIOS = Platform.OS === 'ios';
const GalleryManager = IsIOS ? NativeModules.CKGalleryManager : NativeModules.NativeGalleryModule;

const FLASH_MODE_AUTO = 'auto';
const FLASH_MODE_ON = 'on';
const FLASH_MODE_OFF = 'off';
const OVERLAY_DEFAULT_COLOR = '#ffffff77';

export default class CameraScreenBase extends Component {

  static propTypes = {
    allowCaptureRetake: PropTypes.bool,
  };

  static defaultProps = {
    allowCaptureRetake: false,
  };

  constructor(props) {
    super(props);
    this.currentFlashArrayPosition = 0;
    this.flashArray = [{
      mode: FLASH_MODE_AUTO,
      image: _.get(this.props, 'flashImages.auto')
    },
    {
      mode: FLASH_MODE_ON,
      image: _.get(this.props, 'flashImages.on')
    },
    {
      mode: FLASH_MODE_OFF,
      image: _.get(this.props, 'flashImages.off')
    }
    ];
    this.state = {
      captureImages: [],
      flashData: this.flashArray[this.currentFlashArrayPosition],
      ratios: [],
      cameraOptions: {},
      ratioArrayPosition: -1,
      imageCaptured: undefined,
      captured: false
    };
    this.onSetFlash = this.onSetFlash.bind(this);
    this.onSwitchCameraPressed = this.onSwitchCameraPressed.bind(this);
  }

  componentDidMount() {
    const cameraOptions = this.getCameraOptions();
    let ratios = [];
    if (this.props.cameraRatioOverlay) {
      ratios = this.props.cameraRatioOverlay.ratios || [];
    }
    this.setState({
      cameraOptions,
      ratios: (ratios || []),
      ratioArrayPosition: ((ratios.length > 0) ? 0 : -1)
    });
  }

  isCaptureRetakeMode() {
    return !!(this.props.allowCaptureRetake && !_.isUndefined(this.state.imageCaptured));
  }

  getCameraOptions() {
    const cameraOptions = this.props.cameraOptions || {
      flashMode: 'auto',
      focusMode: 'on',
      zoomMode: 'on'
    };
    if (this.props.cameraRatioOverlay) {
      const overlay = this.props.cameraRatioOverlay;
      cameraOptions.ratioOverlayColor = overlay.color || OVERLAY_DEFAULT_COLOR;

      if (overlay.ratios && overlay.ratios.length > 0) {
        cameraOptions.ratioOverlay = overlay.ratios[0];
      }
    }

    return cameraOptions;
  }

  renderFlashButton() {
    return !this.isCaptureRetakeMode() &&
      <TouchableOpacity style={{ paddingHorizontal: 15 }} onPress={() => this.onSetFlash(FLASH_MODE_AUTO)}>
        <Image
          style={{ flex: 1, justifyContent: 'center' }}
          source={this.state.flashData.image}
          resizeMode={Image.resizeMode.contain}
        />
      </TouchableOpacity>
  }

  renderSwitchCameraButton() {
    return (this.props.cameraFlipImage && !this.isCaptureRetakeMode()) &&
      <TouchableOpacity style={{ paddingHorizontal: 15 }} onPress={this.onSwitchCameraPressed}>
        <Image
          style={{ flex: 1, justifyContent: 'center' }}
          source={this.props.cameraFlipImage}
          resizeMode={Image.resizeMode.contain}
        />
      </TouchableOpacity>
  }

  renderTopButtons() {
    return (
      <View style={styles.topButtons}>
        {this.renderFlashButton()}
        {this.renderSwitchCameraButton()}
      </View>
    );
  }

  renderCamera() {
    return (
      <View style={styles.cameraContainer}>
        {
          this.isCaptureRetakeMode() ?
          <Image
            style={{flex: 1, justifyContent: 'flex-end'}}
            source={{uri: this.state.imageCaptured.uri}}
          /> :
          <CameraKitCamera
            ref={(cam) => this.camera = cam}
            style={{flex: 1, justifyContent: 'flex-end'}}
            cameraOptions={this.state.cameraOptions}
          />
        }
      </View>
    );
  }

  numberOfImagesTaken() {
    const numberTook = this.state.captureImages.length;
    if (numberTook >= 2) {
      return numberTook;
    } else if (this.state.captured) {
      return '1';
    } else {
      return '';
    }
  }

  renderCaptureButton() {
    return (this.props.captureButtonImage && !this.isCaptureRetakeMode()) &&
      <View style={styles.captureButtonContainer}>
        <TouchableOpacity
          onPress={() => this.onCaptureImagePressed()}
        >
          <ImageBackground
            style={styles.captureButton}
            source={this.props.captureButtonImage}
          >
            <Text style={styles.captureNumber}>
              {this.numberOfImagesTaken()}
            </Text>
          </ImageBackground>
        </TouchableOpacity>
      </View >
  }

  renderRatioStrip() {
    if (this.state.ratios.length === 0) {
      return null;
    }
    return (
      <View style={{ flex: 1, flexDirection: 'column', justifyContent: 'flex-end' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 10, paddingLeft: 20 }}>
          <Text style={styles.ratioBestText}>Your images look best at a {this.state.ratios[0] || ''} ratio</Text>
          <TouchableOpacity
            style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', padding: 8 }}
            onPress={() => this.onRatioButtonPressed()}
          >
            <Text style={styles.ratioText}>{this.state.cameraOptions.ratioOverlay}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  sendBottomButtonPressedAction(type, captureRetakeMode, image) {
    if(this.props.onBottomButtonPressed) {
      this.props.onBottomButtonPressed({ type, captureImages: this.state.captureImages, captureRetakeMode, image })
    }
  }

  async onButtonPressed(type) {
    const captureRetakeMode = this.isCaptureRetakeMode();
    if (captureRetakeMode) {
      if(type === 'left') {
        GalleryManager.deleteTempImage(this.state.imageCaptured.uri);
        this.setState({imageCaptured: undefined});
      }
      else if(type === 'right') {
        const result = await GalleryManager.saveImageURLToCameraRoll(this.state.imageCaptured.uri);
        const savedImage = {...this.state.imageCaptured, ...result}; // Note: Can't just return 'result' as on iOS not all data is returned by the native call (just the ID).
        this.setState({imageCaptured: undefined, captureImages: _.concat(this.state.captureImages, savedImage)}, () => {
          this.sendBottomButtonPressedAction(type, captureRetakeMode);
        });
      }
    } else {
      this.sendBottomButtonPressedAction(type, captureRetakeMode);
    }
  }

  renderBottomButton(type) {
    let showButton = true;
    if (type === 'right') {
      showButton = this.state.captureImages.length || this.isCaptureRetakeMode();
    }
    if (showButton) {
      const buttonNameSuffix = this.isCaptureRetakeMode() ? 'CaptureRetakeButtonText' : 'ButtonText';
      const buttonText = _(this.props).get(`actions.${type}${buttonNameSuffix}`)
      return (
        <TouchableOpacity
          style={[styles.bottomButton, { justifyContent: type === 'left' ? 'flex-start' : 'flex-end' }]}
          onPress={() => this.onButtonPressed(type)}
        >
          <Text style={styles.textStyle}>{buttonText}</Text>
        </TouchableOpacity>
      );
    } else {
      return (
        <View style={styles.bottomContainerGap} />
      );
    }
  }

  renderBottomButtons() {
    return (
      <View style={[styles.bottomButtons, {backgroundColor: '#ffffff00'}]}>
        {this.renderBottomButton('left')}
        {this.renderCaptureButton()}
        {this.renderBottomButton('right')}
      </View>
    );
  }

  onSwitchCameraPressed() {
    this.camera.changeCamera();
  }

  async onSetFlash() {
    this.currentFlashArrayPosition = (this.currentFlashArrayPosition + 1) % 3;
    const newFlashData = this.flashArray[this.currentFlashArrayPosition];
    this.setState({ flashData: newFlashData });
    this.camera.setFlashMode(newFlashData.mode);
  }

  async onCaptureImagePressed() {
    const shouldSaveToCameraRoll = !this.props.allowCaptureRetake;
    const image = await this.camera.capture(shouldSaveToCameraRoll);

    if (this.props.allowCaptureRetake) {
      this.setState({ imageCaptured: image });
    } else {
      if (image) {
        this.setState({ captured: true, imageCaptured: image, captureImages: _.concat(this.state.captureImages, image) });
      }
      this.sendBottomButtonPressedAction('capture', false, image);
    }
  }

  onRatioButtonPressed() {
    const newRatiosArrayPosition = ((this.state.ratioArrayPosition + 1) % this.state.ratios.length);
    const newCameraOptions = _.update(this.state.cameraOptions, 'ratioOverlay', (val) => this.state.ratios[newRatiosArrayPosition]);
    this.setState({ ratioArrayPosition: newRatiosArrayPosition, cameraOptions: newCameraOptions });
  }

  render() {
    throw ('Implemented in CameraKitCameraScreen!');
  }
}

import styleObject from './CameraKitCameraScreenStyleObject';
const styles = StyleSheet.create(_.merge(styleObject, {
  textStyle: {
    color: 'white',
    fontSize: 20
  },
  ratioBestText: {
    color: 'white',
    fontSize: 18,
  },
  ratioText: {
    color: '#ffc233',
    fontSize: 18
  },
  topButtons: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 0
  },
  cameraContainer: {
    flex: 10,
    flexDirection: 'column'
  },
  captureButtonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: 66,
    height: 66
  },
  captureNumber: {
    justifyContent: 'center',
    color: 'black',
    backgroundColor: 'transparent'
  },
  bottomButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10
  },
  bottomContainerGap: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 10
  }
}));
